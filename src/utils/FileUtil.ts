
type JpegOrientationProbeResult = 'none' | 'rotated' | 'unknown';

export class FileUtil {
    // Real-world EXIF blocks live well within the first few KB of a JPEG; 128KB gives generous
    // headroom while staying tiny relative to reading (and re-encoding) the whole file.
    private static readonly HEADER_PROBE_SIZE = 128 * 1024;
    private static readonly EXIF_ORIENTATION_TAG = 0x0112;

    public static loadImageBase64(fileData: File): Promise<string | ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileData);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }

    public static async loadImage(fileData: File): Promise<HTMLImageElement> {
        const probeResult = await FileUtil.probeJpegOrientation(fileData);
        // 'none' means we've confirmed there's no EXIF rotation to normalize away (true for
        // non-JPEGs and most JPEGs), so a plain decode already matches the un-rotated raw pixels.
        // Anything else ('rotated' or 'unknown') falls back to the slower normalize-then-decode path.
        return probeResult === 'none'
            ? FileUtil.loadImagePlain(fileData)
            : FileUtil.loadImageWithNormalizedOrientation(fileData);
    }

    public static loadImages(fileData: File[]): Promise<HTMLImageElement[]> {
        return new Promise((resolve, reject) => {
            const promises: Promise<HTMLImageElement>[] = fileData.map((data: File) => FileUtil.loadImage(data));
            Promise
                .all(promises)
                .then((values: HTMLImageElement[]) => resolve(values))
                .catch((error) => reject(error));
        });
    }

    public static readFile(fileData: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = (event: any) => {
                resolve(event?.target?.result);
            };
            reader.onerror = reject;
            reader.readAsText(fileData);
        });
    }

    public static readFiles(fileData: File[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const promises: Promise<string>[] = fileData.map((data: File) => FileUtil.readFile(data));
            Promise
                .all(promises)
                .then((values: string[]) => resolve(values))
                .catch((error) => reject(error));
        });
    }

    public static extractFileExtension(name: string): string | null {
        const parts = name.split('.');
        return parts.length > 1 ? parts[parts.length - 1] : null;
    }

    public static extractFileName(name: string): string | null {
        const splitPath = name.split('.');
        let fName = '';
        for (const idx of Array(splitPath.length - 1).keys()) {
            if (fName === '') fName += splitPath[idx];
            else fName += '.' + splitPath[idx];
        }
        return fName;
    }

    private static loadImagePlain(fileData: File | Blob): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            // Not revoked: the resulting image is cached long-term (ImageRepository) and other
            // consumers (e.g. thumbnails) reuse `image.src` directly to render their own <img> tags.
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = URL.createObjectURL(fileData);
        });
    }

    private static loadImageWithNormalizedOrientation(fileData: File): Promise<HTMLImageElement> {
        return new Promise(async (resolve, reject) => {
            try {
                // Decode ignoring EXIF orientation so everything stays in raw pixel space, matching
                // cv2/COCO tooling. Browsers auto-rotate images loaded via `new Image()` per their EXIF
                // Orientation tag, which would misalign imported (un-rotated) annotation coordinates.
                const bitmap = await createImageBitmap(fileData, {imageOrientation: 'none'});
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0);
                bitmap.close();
                canvas.toBlob((blob: Blob) => {
                    // The re-encoded blob carries no EXIF tag, so all consumers see identical raw pixels.
                    FileUtil.loadImagePlain(blob).then(resolve, reject);
                }, 'image/png'); // PNG is lossless, preserving annotation fidelity.
            } catch (error) {
                // Fallback for environments without createImageBitmap orientation support.
                FileUtil.loadImagePlain(fileData).then(resolve, reject);
            }
        });
    }

    private static async probeJpegOrientation(fileData: File): Promise<JpegOrientationProbeResult> {
        try {
            const buffer = await fileData.slice(0, FileUtil.HEADER_PROBE_SIZE).arrayBuffer();
            const view = new DataView(buffer);

            if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
                return 'none'; // Not a JPEG - other formats aren't auto-rotated by the browser.
            }

            let offset = 2;
            while (offset + 4 <= view.byteLength) {
                const marker = view.getUint16(offset, false);
                if ((marker & 0xFF00) !== 0xFF00) {
                    return 'unknown'; // Malformed segment - don't guess, take the safe path.
                }
                if (marker === 0xFFDA) {
                    return 'none'; // Scan data reached before any EXIF block: no orientation tag applies.
                }
                if (marker === 0xFFD8 || marker === 0xFFD9 || (marker >= 0xFFD0 && marker <= 0xFFD7)) {
                    offset += 2; // Standalone markers carry no length field.
                    continue;
                }

                const segmentLength = view.getUint16(offset + 2, false);
                if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) {
                    return 'unknown'; // Truncated within our probe window - can't be sure.
                }

                if (marker === 0xFFE1) {
                    const orientation = FileUtil.readOrientationFromExifSegment(view, offset + 4, segmentLength - 2);
                    if (orientation !== null) {
                        return orientation === 1 ? 'none' : 'rotated';
                    }
                }

                offset += 2 + segmentLength;
            }

            return 'unknown'; // Ran out of probe window without resolving EXIF - can't be sure.
        } catch (error) {
            return 'unknown';
        }
    }

    private static readOrientationFromExifSegment(view: DataView, start: number, length: number): number | null {
        if (length < 8 || start + 8 > view.byteLength) {
            return null;
        }
        // "Exif\0\0" header.
        if (view.getUint32(start, false) !== 0x45786966 || view.getUint16(start + 4, false) !== 0x0000) {
            return null;
        }

        const tiffStart = start + 6;
        if (tiffStart + 8 > view.byteLength) {
            return null;
        }

        const byteOrderMarker = view.getUint16(tiffStart, false);
        const littleEndian = byteOrderMarker === 0x4949;
        if (!littleEndian && byteOrderMarker !== 0x4D4D) {
            return null;
        }
        if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002A) {
            return null;
        }

        const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
        const ifdStart = tiffStart + firstIfdOffset;
        if (ifdStart < tiffStart || ifdStart + 2 > view.byteLength) {
            return null;
        }

        const entryCount = view.getUint16(ifdStart, littleEndian);
        for (let i = 0; i < entryCount; i++) {
            const entryOffset = ifdStart + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) {
                break;
            }
            if (view.getUint16(entryOffset, littleEndian) === FileUtil.EXIF_ORIENTATION_TAG) {
                return view.getUint16(entryOffset + 8, littleEndian);
            }
        }

        return null;
    }
}
