
export class FileUtil {
    public static loadImageBase64(fileData: File): Promise<string | ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(fileData);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }

    public static loadImage(fileData: File): Promise<HTMLImageElement> {
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
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    // The re-encoded blob carries no EXIF tag, so all consumers see identical raw pixels.
                    image.src = URL.createObjectURL(blob);
                }, 'image/png'); // PNG is lossless, preserving annotation fidelity.
            } catch (error) {
                // Fallback for environments without createImageBitmap orientation support.
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = URL.createObjectURL(fileData);
            }
        });
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
}
