import { v4 as uuidv4 } from 'uuid';
import { isEqual } from 'lodash';
import { ImageData, LabelName, LabelRect } from '../../store/labels/types';
import { LabelUtil } from '../../utils/LabelUtil';
import { ArrayUtil } from '../../utils/ArrayUtil';
import { Settings } from '../../settings/Settings';
import { IRect } from '../../interfaces/IRect';
import { ReviewFolderError, VOCReviewFolder } from './ReviewFolderReader';

// Deleted objects stay in their .xml file, named "<name>_deleted"
export const VOC_DELETED_SUFFIX = '_deleted';

// Which label of the editor an <object> of a .xml file became, and what it looked like when the
// folder was loaded: only the objects that were moved, deleted or re-added since are rewritten.
type VOCObjectLink = {
    // Position of the <object> among the <object> children of <annotation>
    objectIndex: number;
    labelId: string;
    // <name> without its "_deleted" suffix
    baseName: string;
    initialRect: IRect;
    initialIsDeleted: boolean;
};

export type VOCLabelFile = {
    fileName: string;
    // The file as it was read: written back as is when none of its objects changed
    text: string;
    links: VOCObjectLink[];
};

export type VOCLoadResult = {
    imagesData: ImageData[];
    labelNames: LabelName[];
    labelFiles: VOCLabelFile[];
    // .xml files whose image the images folder does not hold
    labelFilesWithoutImage: string[];
    // Images no .xml file describes
    imagesWithoutLabelFile: string[];
};

export class ReviewVOC {
    public static async load(folder: VOCReviewFolder, imagesData: ImageData[]): Promise<VOCLoadResult> {
        const labelsFolder = folder.labelsFolderName;
        const imageByName = new Map<string, ImageData>();
        const imageByStem = new Map<string, ImageData>();
        imagesData.forEach((imageData: ImageData) => {
            imageByName.set(imageData.fileData.name, imageData);
            imageByStem.set(ReviewVOC.getStem(imageData.fileData.name), imageData);
        });

        const problems: string[] = [];
        const addProblem = (problem: string) => {
            if (!problems.includes(problem)) {
                problems.push(problem);
            }
        };
        const labelByBaseName = new Map<string, LabelName>();
        const labelFileByImageId = new Map<string, string>();
        const labelFiles: VOCLabelFile[] = [];
        const labelFilesWithoutImage: string[] = [];

        const sortedFiles = [...folder.labelFiles]
            .sort((a: File, b: File) => ReviewVOC.collator.compare(a.name, b.name));
        for (const file of sortedFiles) {
            const path = `${labelsFolder}/${file.name}`;
            const text = await file.text();
            const root = ReviewVOC.parseRoot(text);
            if (!root) {
                addProblem(`"${path}" is not a valid Pascal VOC .xml file.`);
                continue;
            }

            // The image is found by the <filename> of the file, else by the stem of the .xml file
            const fileName = ReviewVOC.getBaseName(ReviewVOC.childText(root, 'filename'));
            const imageData = imageByName.get(fileName) || imageByStem.get(ReviewVOC.getStem(file.name));
            const labelFile: VOCLabelFile = { fileName: file.name, text, links: [] };
            labelFiles.push(labelFile);
            if (!imageData) {
                // Written back untouched on export
                labelFilesWithoutImage.push(file.name);
                continue;
            }
            const otherFile = labelFileByImageId.get(imageData.id);
            if (otherFile) {
                addProblem(`"${labelsFolder}/${otherFile}" and "${path}" both describe the image `
                    + `"${imageData.fileData.name}": keep only one of them.`);
                continue;
            }
            labelFileByImageId.set(imageData.id, file.name);

            const size = ReviewVOC.childElement(root, 'size');
            const width = Number(ReviewVOC.childText(size, 'width'));
            const height = Number(ReviewVOC.childText(size, 'height'));
            if (width > 0 && height > 0) {
                imageData.imgWidth = width;
                imageData.imgHeight = height;
            }

            ReviewVOC.getObjects(root).forEach((object: Element, objectIndex: number) => {
                const name = ReviewVOC.childText(object, 'name');
                if (!name) {
                    addProblem(`"${path}": an object has no <name>.`);
                    return;
                }
                const rect = ReviewVOC.readRect(object);
                if (!rect) {
                    addProblem(`"${path}": the object "${name}" has no valid <bndbox> `
                        + '(xmin, ymin, xmax and ymax numbers).');
                    return;
                }
                const isDeleted = name.endsWith(VOC_DELETED_SUFFIX) && name.length > VOC_DELETED_SUFFIX.length;
                const baseName = isDeleted ? name.slice(0, -VOC_DELETED_SUFFIX.length) : name;
                if (!labelByBaseName.has(baseName)) {
                    labelByBaseName.set(baseName, {
                        id: uuidv4(),
                        name: baseName,
                        color: ArrayUtil.getByInfiniteIndex(Settings.LABEL_COLORS_PALETTE, labelByBaseName.size),
                    });
                }
                const labelRect: LabelRect = {
                    ...LabelUtil.createLabelRect(labelByBaseName.get(baseName).id, rect),
                    isDeleted,
                };
                imageData.labelRects.push(labelRect);
                labelFile.links.push({
                    objectIndex,
                    labelId: labelRect.id,
                    baseName,
                    initialRect: { ...rect },
                    initialIsDeleted: isDeleted,
                });
            });
        }

        if (problems.length > 0) {
            throw new ReviewFolderError(problems);
        }

        return {
            imagesData,
            labelNames: Array.from(labelByBaseName.values()),
            labelFiles,
            labelFilesWithoutImage,
            imagesWithoutLabelFile: imagesData
                .filter((imageData: ImageData) => !labelFileByImageId.has(imageData.id))
                .map((imageData: ImageData) => imageData.fileData.name),
        };
    }

    // Every .xml file that was loaded: the ones where nothing changed exactly as they were read, the
    // others with the new <bndbox> of the moved objects and the "_deleted" suffix on the <name> of
    // the deleted ones. Everything else (tags, size, other elements) is kept as it was.
    public static buildReviewedFiles(
        labelFiles: VOCLabelFile[],
        imagesData: ImageData[]
    ): { fileName: string; content: string }[] {
        const rectById = new Map<string, LabelRect>();
        imagesData.forEach((imageData: ImageData) =>
            imageData.labelRects.forEach((labelRect: LabelRect) => rectById.set(labelRect.id, labelRect)));

        return labelFiles.map((labelFile: VOCLabelFile) => {
            const changes = labelFile.links
                .map((link: VOCObjectLink) => ({ link, labelRect: rectById.get(link.labelId) }))
                .filter(({ link, labelRect }) => labelRect && (
                    !isEqual(labelRect.rect, link.initialRect) || !!labelRect.isDeleted !== link.initialIsDeleted
                ));
            if (changes.length === 0) {
                return { fileName: labelFile.fileName, content: labelFile.text };
            }

            const document = new DOMParser().parseFromString(labelFile.text, 'application/xml');
            const objects = ReviewVOC.getObjects(document.documentElement);
            changes.forEach(({ link, labelRect }) => {
                const object = objects[link.objectIndex];
                if (!isEqual(labelRect.rect, link.initialRect)) {
                    ReviewVOC.writeRect(object, labelRect.rect);
                }
                if (!!labelRect.isDeleted !== link.initialIsDeleted) {
                    ReviewVOC.childElement(object, 'name').textContent =
                        `${link.baseName}${labelRect.isDeleted ? VOC_DELETED_SUFFIX : ''}`;
                }
            });
            return { fileName: labelFile.fileName, content: ReviewVOC.serialize(document, labelFile.text) };
        });
    }

    private static readonly collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    private static parseRoot(text: string): Element | null {
        const document = new DOMParser().parseFromString(text, 'application/xml');
        const root = document.documentElement;
        if (!root || document.getElementsByTagName('parsererror').length > 0 || root.nodeName !== 'annotation') {
            return null;
        }
        return root;
    }

    private static getObjects(root: Element): Element[] {
        return Array.from(root.children).filter((child: Element) => child.nodeName === 'object');
    }

    private static childElement(parent: Element | null | undefined, name: string): Element | null {
        return parent ? Array.from(parent.children).find((child: Element) => child.nodeName === name) || null : null;
    }

    private static childText(parent: Element | null | undefined, name: string): string {
        return (ReviewVOC.childElement(parent, name)?.textContent || '').trim();
    }

    private static readRect(object: Element): IRect | null {
        const box = ReviewVOC.childElement(object, 'bndbox');
        const [xmin, ymin, xmax, ymax] = ['xmin', 'ymin', 'xmax', 'ymax']
            .map((name: string) => ReviewVOC.childText(box, name))
            .map((value: string) => value === '' ? NaN : Number(value));
        if (!box || [xmin, ymin, xmax, ymax].some((value: number) => !Number.isFinite(value))) {
            return null;
        }
        return {
            x: Math.min(xmin, xmax),
            y: Math.min(ymin, ymax),
            width: Math.abs(xmax - xmin),
            height: Math.abs(ymax - ymin),
        };
    }

    // Pascal VOC coordinates are whole pixels
    private static writeRect(object: Element, rect: IRect): void {
        const box = ReviewVOC.childElement(object, 'bndbox');
        const values: Record<string, number> = {
            xmin: Math.round(rect.x),
            ymin: Math.round(rect.y),
            xmax: Math.round(rect.x + rect.width),
            ymax: Math.round(rect.y + rect.height),
        };
        Object.entries(values).forEach(([name, value]) => {
            ReviewVOC.childElement(box, name).textContent = String(value);
        });
    }

    // XMLSerializer drops the <?xml ...?> declaration and the line break ending the file: both are
    // put back when the file had them
    private static serialize(document: Document, originalText: string): string {
        let content = new XMLSerializer().serializeToString(document);
        const declaration = originalText.match(/^\s*(<\?xml[^?]*\?>)(\r?\n)?/);
        if (declaration && !content.startsWith('<?xml')) {
            content = `${declaration[1]}${declaration[2] || '\n'}${content}`;
        }
        const ending = originalText.match(/\s*$/)[0];
        return content.endsWith(ending) ? content : `${content.replace(/\s*$/, '')}${ending}`;
    }

    private static getBaseName(path: string): string {
        const parts = String(path ?? '').split(/[\\/]/);
        return parts[parts.length - 1];
    }

    private static getStem(fileName: string): string {
        const dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.slice(0, dot) : fileName;
    }
}
