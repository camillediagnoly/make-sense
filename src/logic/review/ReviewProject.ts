import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { isEqual } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { ImageData, LabelName, LabelPolygon, LabelRect } from '../../store/labels/types';
import { COCOAnnotation, COCOCategory, COCOImage, COCOObject } from '../../data/labels/COCO';
import { MeasurementFunctionByName } from '../../data/measurements/MeasurementFunctionData';
import { COCOImporter, LabelNameMap } from '../import/coco/COCOImporter';
import { COCOUtils } from '../import/coco/COCOUtils';
import { COCOExporter } from '../export/polygon/COCOExporter';
import { ImageDataUtil } from '../../utils/ImageDataUtil';
import { LabelUtil } from '../../utils/LabelUtil';
import { ArrayUtil } from '../../utils/ArrayUtil';
import { Settings } from '../../settings/Settings';
import { IPoint } from '../../interfaces/IPoint';
import { IRect } from '../../interfaces/IRect';
import { LocalFileSystemDirectoryHandle } from '../../interfaces/IFileSystemAccess';
import { COCOReviewFolder, ReviewFolder, ReviewFolderError } from './ReviewFolderReader';
import { ReviewVOC, VOCLabelFile } from './ReviewVOC';

// Category names starting with this are rectangles, the ones starting with POLYGON_PREFIX are polygons
const RECT_PREFIX = 'q';
const POLYGON_PREFIX = 'p';

// Which labels of the editor an annotation of the original file became, and what they looked like
// when the folder was loaded: only the annotations that were moved since are rewritten on export.
type AnnotationLink = {
    annotationIndex: number;
    // Category name without its "_deleted" suffix
    baseCategoryName: string;
} & (
    | { kind: 'rect'; labelId: string; initialRect: IRect }
    | { kind: 'polygon'; labelIds: string[]; initialVertices: IPoint[][] }
);

// Deleted annotations stay in the file, with the "<category>_deleted" category
export const DELETED_SUFFIX = '_deleted';

export type ReviewProjectLoadResult = {
    imagesData: ImageData[];
    labelNames: LabelName[];
    measurementFunctionByName: MeasurementFunctionByName;
    // The images the annotations describe but the images folder does not hold: file_name of the
    // json images, or name of the .xml files
    missingImageNames: string[];
    // Images no .xml file describes (always empty for a .json file)
    imagesWithoutAnnotations: string[];
};

// fileName is the .json file, or the labels_reviewed/ folder (with fileCount .xml files in it)
export type ReviewExportResult =
    | { kind: 'folder'; folderName: string; fileName: string; fileCount?: number }
    | { kind: 'download'; fileName: string; fileCount?: number };

// Gives access to the protected COCO import helpers
class ReviewCOCOImporter extends COCOImporter {
    public static getMeasurementFunctionByName(
        cocoObject: COCOObject,
        labelNameMap: LabelNameMap
    ): MeasurementFunctionByName {
        return COCOImporter.mapMeasurementConfig(cocoObject.meas_config, labelNameMap);
    }
}

export class ReviewProject {
    private static folder: ReviewFolder | null = null;
    private static originalCOCO: COCOObject | null = null;
    private static annotationLinks: AnnotationLink[] = [];
    private static vocLabelFiles: VOCLabelFile[] = [];

    public static getFolderName(): string | null {
        return ReviewProject.folder?.name ?? null;
    }

    // The .json file, or the labels folder, "Export current folder" writes
    public static getReviewedJsonFileName(): string {
        const folder = ReviewProject.folder;
        return folder.format === 'coco' ? folder.reviewedJsonName : folder.reviewedLabelsFolderName;
    }

    public static clear(): void {
        ReviewProject.folder = null;
        ReviewProject.originalCOCO = null;
        ReviewProject.annotationLinks = [];
        ReviewProject.vocLabelFiles = [];
    }

    // =================================================================================================================
    // IMPORT
    // =================================================================================================================

    public static async load(folder: ReviewFolder): Promise<ReviewProjectLoadResult> {
        if (folder.format === 'voc') {
            const imagesData: ImageData[] = [...folder.imageFiles].sort(ReviewProject.naturalSort)
                .map((file: File) => ImageDataUtil.createImageDataFromFileData(file));
            const result = await ReviewVOC.load(folder, imagesData);
            ReviewProject.folder = folder;
            ReviewProject.originalCOCO = null;
            ReviewProject.annotationLinks = [];
            ReviewProject.vocLabelFiles = result.labelFiles;
            return {
                imagesData: result.imagesData,
                labelNames: result.labelNames,
                measurementFunctionByName: {},
                missingImageNames: result.labelFilesWithoutImage,
                imagesWithoutAnnotations: result.imagesWithoutLabelFile,
            };
        }
        const cocoObject: COCOObject = ReviewProject.parseJson(folder.jsonFile.name, await folder.jsonFile.text());
        const result = ReviewProject.buildProject(folder, cocoObject);
        ReviewProject.folder = folder;
        ReviewProject.originalCOCO = cocoObject;
        return result;
    }

    private static parseJson(fileName: string, text: string): COCOObject {
        let cocoObject: COCOObject;
        try {
            cocoObject = JSON.parse(text);
        } catch (error) {
            throw new ReviewFolderError([`"${fileName}" is not a valid JSON file.`]);
        }
        const missingKeys = COCOImporter.requiredKeys
            .filter((key: string) => !cocoObject || !Array.isArray(cocoObject[key]));
        if (missingKeys.length > 0) {
            throw new ReviewFolderError([
                `"${fileName}" is not a COCO annotation file: it has no ${missingKeys.map((key) => `"${key}"`).join(', ')} list.`
            ]);
        }
        return cocoObject;
    }

    private static buildProject(folder: COCOReviewFolder, cocoObject: COCOObject): ReviewProjectLoadResult {
        const { images, categories, annotations } = cocoObject;
        const jsonName = folder.jsonFile.name;

        // "<name>" and "<name>_deleted" are the same label: the suffix only marks deleted annotations
        const labelByBaseName = new Map<string, LabelName>();
        const labelNameMap: LabelNameMap = {};
        const categoryById: Record<number, { baseName: string; isDeleted: boolean }> = {};
        categories.forEach((category: COCOCategory) => {
            const name = String(category.name ?? '');
            const isDeleted = name.endsWith(DELETED_SUFFIX) && name.length > DELETED_SUFFIX.length;
            const baseName = isDeleted ? name.slice(0, -DELETED_SUFFIX.length) : name;
            if (!labelByBaseName.has(baseName)) {
                labelByBaseName.set(baseName, {
                    id: uuidv4(),
                    name: baseName,
                    color: ArrayUtil.getByInfiniteIndex(Settings.LABEL_COLORS_PALETTE, labelByBaseName.size),
                });
            }
            labelNameMap[category.id] = labelByBaseName.get(baseName);
            categoryById[category.id] = { baseName, isDeleted };
        });

        const sortedImageFiles = [...folder.imageFiles].sort(ReviewProject.naturalSort);
        const imagesData: ImageData[] = sortedImageFiles
            .map((file: File) => ImageDataUtil.createImageDataFromFileData(file));
        const imageDataByFileName = new Map<string, ImageData>(
            imagesData.map((imageData: ImageData) => [imageData.fileData.name, imageData]));

        const imageDataByCOCOId = new Map<number, ImageData>();
        const missingImageNames: string[] = [];
        images.forEach((image: COCOImage) => {
            const imageData = imageDataByFileName.get(ReviewProject.getBaseName(image.file_name));
            if (!imageData) {
                missingImageNames.push(image.file_name);
                return;
            }
            imageData.imgWidth = image.width;
            imageData.imgHeight = image.height;
            imageDataByCOCOId.set(image.id, imageData);
        });

        const problems: string[] = [];
        const addProblem = (problem: string) => {
            if (!problems.includes(problem)) {
                problems.push(problem);
            }
        };
        const links: AnnotationLink[] = [];

        annotations.forEach((annotation: COCOAnnotation, annotationIndex: number) => {
            const imageData = imageDataByCOCOId.get(annotation.image_id);
            // Annotations of images that are not in the folder are written back untouched
            if (!imageData || annotation.iscrowd === 1) {
                return;
            }
            const labelName: LabelName = labelNameMap[annotation.category_id];
            if (!labelName) {
                addProblem(`"${jsonName}": an annotation has category_id ${annotation.category_id}, `
                    + 'which is not in the categories list.');
                return;
            }
            const { baseName: categoryName, isDeleted } = categoryById[annotation.category_id];

            if (categoryName.startsWith(RECT_PREFIX)) {
                const rect: IRect | null = ReviewProject.getAnnotationRect(annotation);
                if (!rect) {
                    addProblem(`"${jsonName}": an annotation of "${categoryName}" has no bbox.`);
                    return;
                }
                const labelRect: LabelRect = { ...LabelUtil.createLabelRect(labelName.id, rect), isDeleted };
                imageData.labelRects.push(labelRect);
                links.push({
                    annotationIndex,
                    baseCategoryName: categoryName,
                    kind: 'rect',
                    labelId: labelRect.id,
                    initialRect: { ...rect },
                });
            } else if (categoryName.startsWith(POLYGON_PREFIX)) {
                const polygons: IPoint[][] = ReviewProject.getAnnotationPolygons(annotation);
                if (polygons.length === 0) {
                    addProblem(`"${jsonName}": an annotation of "${categoryName}" has no polygon segmentation.`);
                    return;
                }
                const labelPolygons: LabelPolygon[] = polygons
                    .map((vertices: IPoint[]) => ({ ...LabelUtil.createLabelPolygon(labelName.id, vertices), isDeleted }));
                imageData.labelPolygons.push(...labelPolygons);
                links.push({
                    annotationIndex,
                    baseCategoryName: categoryName,
                    kind: 'polygon',
                    labelIds: labelPolygons.map((labelPolygon: LabelPolygon) => labelPolygon.id),
                    initialVertices: polygons.map((vertices: IPoint[]) => vertices.map((point) => ({ ...point }))),
                });
            } else {
                addProblem(`"${jsonName}": the category "${categoryName}" starts neither with "${RECT_PREFIX}" `
                    + `(rectangle) nor with "${POLYGON_PREFIX}" (polygon).`);
            }
        });

        if (problems.length > 0) {
            throw new ReviewFolderError(problems);
        }

        ReviewProject.annotationLinks = links;
        return {
            imagesData,
            labelNames: Array.from(labelByBaseName.values()),
            measurementFunctionByName: ReviewCOCOImporter.getMeasurementFunctionByName(cocoObject, labelNameMap),
            missingImageNames,
            imagesWithoutAnnotations: [],
        };
    }

    private static getAnnotationRect(annotation: COCOAnnotation): IRect | null {
        if (Array.isArray(annotation.bbox) && annotation.bbox.length === 4) {
            return COCOUtils.bbox2rect(annotation.bbox);
        }
        const polygons = ReviewProject.getAnnotationPolygons(annotation);
        return polygons.length > 0 ? ReviewProject.getBoundingRect(polygons.flat()) : null;
    }

    private static getAnnotationPolygons(annotation: COCOAnnotation): IPoint[][] {
        const segmentation: unknown = annotation.segmentation;
        // RLE masks are objects: they have no vertices to move
        if (!Array.isArray(segmentation) || !segmentation.every((segment) => Array.isArray(segment))) {
            return [];
        }
        return COCOUtils.segmentation2vertices(segmentation)
            .filter((vertices: IPoint[]) => vertices.length > 0);
    }

    private static getBaseName(path: string): string {
        const parts = String(path ?? '').split(/[\\/]/);
        return parts[parts.length - 1];
    }

    private static naturalSort(a: File, b: File): number {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        return collator.compare(a.name, b.name);
    }

    // =================================================================================================================
    // EXPORT
    // =================================================================================================================

    // The polygons coming from the same annotation (a segmentation made of several polygons): they
    // are deleted and re-added together
    public static getAnnotationLabelIds(labelId: string): string[] {
        const link = ReviewProject.annotationLinks.find((annotationLink: AnnotationLink) =>
            annotationLink.kind === 'rect' ? annotationLink.labelId === labelId : annotationLink.labelIds.includes(labelId));
        if (!link) {
            return [labelId];
        }
        return link.kind === 'rect' ? [link.labelId] : link.labelIds;
    }

    // The original file, where the annotations that were moved get their new geometry, and the
    // deleted ones the "<category>_deleted" category (created when the file has none). Everything
    // else (ids, other keys, annotations that were not changed) is kept as it was.
    public static buildReviewedCOCO(imagesData: ImageData[]): COCOObject {
        const reviewed: COCOObject = JSON.parse(JSON.stringify(ReviewProject.originalCOCO));
        const rectById = new Map<string, LabelRect>();
        const polygonById = new Map<string, LabelPolygon>();
        imagesData.forEach((imageData: ImageData) => {
            imageData.labelRects.forEach((labelRect: LabelRect) => rectById.set(labelRect.id, labelRect));
            imageData.labelPolygons.forEach((labelPolygon: LabelPolygon) => polygonById.set(labelPolygon.id, labelPolygon));
        });

        ReviewProject.annotationLinks.forEach((link: AnnotationLink) => {
            const annotation = reviewed.annotations[link.annotationIndex];
            let isDeleted: boolean;
            if (link.kind === 'rect') {
                const labelRect = rectById.get(link.labelId);
                if (!labelRect) {
                    return;
                }
                isDeleted = !!labelRect.isDeleted;
                if (!isEqual(labelRect.rect, link.initialRect)) {
                    ReviewProject.writeRect(annotation, labelRect.rect);
                }
            } else {
                const labelPolygons = link.labelIds.map((id: string) => polygonById.get(id));
                if (labelPolygons.some((labelPolygon) => !labelPolygon)) {
                    return;
                }
                isDeleted = labelPolygons.every((labelPolygon: LabelPolygon) => !!labelPolygon.isDeleted);
                const vertices: IPoint[][] = labelPolygons.map((labelPolygon: LabelPolygon) => labelPolygon.vertices);
                if (!isEqual(vertices, link.initialVertices)) {
                    ReviewProject.writePolygons(annotation, vertices);
                }
            }
            const categoryName = `${link.baseCategoryName}${isDeleted ? DELETED_SUFFIX : ''}`;
            const currentCategory = reviewed.categories
                .find((category: COCOCategory) => category.id === annotation.category_id);
            if (!currentCategory || currentCategory.name !== categoryName) {
                annotation.category_id = ReviewProject.getOrCreateCategoryId(reviewed, categoryName, currentCategory);
            }
        });
        return reviewed;
    }

    // The id of the category with this name, added at the end of the categories (with the other
    // keys of the category it comes from) when there is none yet
    private static getOrCreateCategoryId(
        cocoObject: COCOObject,
        name: string,
        sourceCategory: COCOCategory | undefined
    ): number {
        const existing = cocoObject.categories.find((category: COCOCategory) => category.name === name);
        if (existing) {
            return existing.id;
        }
        const id = Math.max(0, ...cocoObject.categories.map((category: COCOCategory) => Number(category.id) || 0)) + 1;
        cocoObject.categories.push({ ...(sourceCategory || {}), id, name });
        return id;
    }

    private static writeRect(annotation: COCOAnnotation, rect: IRect): void {
        const x = ReviewProject.round(rect.x);
        const y = ReviewProject.round(rect.y);
        const width = ReviewProject.round(rect.width);
        const height = ReviewProject.round(rect.height);
        annotation.bbox = [x, y, width, height];
        if ('area' in annotation) {
            annotation.area = ReviewProject.round(width * height);
        }
        // Keep a polygon segmentation, when the rectangle has one, in line with its bbox
        if (Array.isArray(annotation.segmentation) && annotation.segmentation.length > 0
            && annotation.segmentation.every((segment) => Array.isArray(segment))) {
            annotation.segmentation = [[x, y, x + width, y, x + width, y + height, x, y + height]];
        }
    }

    private static writePolygons(annotation: COCOAnnotation, polygons: IPoint[][]): void {
        const roundedPolygons: IPoint[][] = polygons.map((vertices: IPoint[]) => vertices.map((point: IPoint) => ({
            x: ReviewProject.round(point.x),
            y: ReviewProject.round(point.y),
        })));
        annotation.segmentation = roundedPolygons
            .map((vertices: IPoint[]) => vertices.flatMap((point: IPoint) => [point.x, point.y]));
        const bbox: IRect = ReviewProject.getBoundingRect(roundedPolygons.flat());
        annotation.bbox = [bbox.x, bbox.y, ReviewProject.round(bbox.width), ReviewProject.round(bbox.height)];
        annotation.area = ReviewProject.round(roundedPolygons
            .reduce((area: number, vertices: IPoint[]) => area + COCOExporter.getCOCOArea(vertices), 0));
    }

    private static getBoundingRect(points: IPoint[]): IRect {
        const xs = points.map((point: IPoint) => point.x);
        const ys = points.map((point: IPoint) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }

    private static round(value: number): number {
        return Math.round(value * 100) / 100;
    }

    // Writes <name>_reviewed.json in the input folder, next to <name>.json (which is never
    // overwritten). Browsers without folder access (Firefox, Safari) download it instead.
    public static async exportReviewedFolder(imagesData: ImageData[]): Promise<ReviewExportResult> {
        if (ReviewProject.folder.format === 'voc') {
            return ReviewProject.exportReviewedLabelsFolder(imagesData);
        }
        const content = JSON.stringify(ReviewProject.buildReviewedCOCO(imagesData), null, 2);
        const fileName = ReviewProject.getReviewedJsonFileName();
        const folderHandle = ReviewProject.folder.directoryHandle;

        if (!folderHandle || !folderHandle.getFileHandle) {
            saveAs(new Blob([content], { type: 'application/json' }), fileName);
            return { kind: 'download', fileName };
        }
        if (!await ReviewProject.hasWritePermission(folderHandle)) {
            throw new Error(`Saving in "${ReviewProject.folder.name}" was not allowed by the browser.`);
        }
        await ReviewProject.writeFile(folderHandle, fileName, content);
        return { kind: 'folder', fileName, folderName: ReviewProject.folder.name };
    }

    // Writes every loaded .xml file in labels_reviewed/, next to labels/ (which is never
    // overwritten). Browsers without folder access (Firefox, Safari) download a zip of it instead.
    private static async exportReviewedLabelsFolder(imagesData: ImageData[]): Promise<ReviewExportResult> {
        const files = ReviewVOC.buildReviewedFiles(ReviewProject.vocLabelFiles, imagesData);
        const folderName = ReviewProject.getReviewedJsonFileName();
        const folderHandle = ReviewProject.folder.directoryHandle;

        if (!folderHandle || !folderHandle.getDirectoryHandle) {
            const zip = new JSZip();
            files.forEach(({ fileName, content }) => zip.file(`${folderName}/${fileName}`, content));
            const zipName = `${folderName}.zip`;
            saveAs(await zip.generateAsync({ type: 'blob' }), zipName);
            return { kind: 'download', fileName: zipName, fileCount: files.length };
        }
        if (!await ReviewProject.hasWritePermission(folderHandle)) {
            throw new Error(`Saving in "${ReviewProject.folder.name}" was not allowed by the browser.`);
        }
        const labelsHandle = await folderHandle.getDirectoryHandle(folderName, { create: true });
        for (const { fileName, content } of files) {
            await ReviewProject.writeFile(labelsHandle, fileName, content);
        }
        return { kind: 'folder', fileName: `${folderName}/`, folderName: ReviewProject.folder.name, fileCount: files.length };
    }

    private static async hasWritePermission(handle: LocalFileSystemDirectoryHandle): Promise<boolean> {
        const descriptor = { mode: 'readwrite' as const };
        try {
            if (handle.queryPermission && await handle.queryPermission(descriptor) === 'granted') {
                return true;
            }
            return !!handle.requestPermission && await handle.requestPermission(descriptor) === 'granted';
        } catch (error) {
            return false;
        }
    }

    private static async writeFile(
        directoryHandle: LocalFileSystemDirectoryHandle,
        fileName: string,
        data: Blob | string
    ): Promise<void> {
        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
    }
}
