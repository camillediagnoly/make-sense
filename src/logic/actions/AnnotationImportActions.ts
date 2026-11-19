import { store } from '../../index';
import { LabelType } from '../../data/enums/LabelType';
import { AnnotationFormatType } from '../../data/enums/AnnotationFormatType';
import { PopupWindowType } from '../../data/enums/PopupWindowType';
import { Notification } from '../../data/enums/Notification';
import { NotificationsDataMap } from '../../data/info/NotificationsData';
import { MeasurementFunctionByName } from '../../data/measurements/MeasurementFunctionData';
import { ImporterSpecData } from '../../data/ImporterSpecData';
import { AnnotationMode, ImageData, LabelName, TagConfig } from '../../store/labels/types';
import {
    updateAnnotationMode,
    updateImageData,
    updateLabelNames,
    updateTagConfig
} from '../../store/labels/actionCreators';
import { updateActivePopupType, updateMeasurementFunctions } from '../../store/general/actionCreators';
import { submitNewNotification } from '../../store/notifications/actionCreators';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../store/selectors/GeneralSelector';
import { DocumentParsingError, PartialVOCImportError } from '../import/voc/VOCImporter';
import { LabelNamesNotUniqueError } from '../import/yolo/YOLOErrors';
import { AnnotationMergeUtil } from '../../utils/AnnotationMergeUtil';
import { NotificationUtil } from '../../utils/NotificationUtil';
import { TagUtil } from '../../utils/TagUtil';

// The label types the menu bar imports
export type ImportableLabelType = AnnotationMode;

export type ImportedAnnotations = {
    labelType: ImportableLabelType;
    imagesData: ImageData[];
    labelNames: LabelName[];
    measurementFunctionByName: MeasurementFunctionByName;
    // null when the format does not know about tags (YOLO): the project tags are then left as they
    // are, since the images keep their tags too.
    tagConfig: TagConfig | null;
    // VOC files that could not be read, while the other files were imported
    failedFileNames: string[];
};

export class AnnotationFormatDetectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AnnotationFormatDetectionError';
    }
}

const YOLO_LABELS_FILE_NAME = 'labels.txt';

export class AnnotationImportActions {
    // Waits here while the user chooses, in the confirm popup, what to do with the annotations
    // already in the project
    private static pendingImport: ImportedAnnotations | null = null;

    public static getLabelTypeName(labelType: ImportableLabelType): string {
        return labelType === LabelType.POLYGON ? 'polygons' : 'rectangles';
    }

    // The format is told by the file extensions: polygons only come from a single COCO JSON file,
    // rectangles from a single COCO JSON file, VOC XML files, or YOLO text files with their
    // labels.txt.
    public static detectFormat(files: File[], labelType: ImportableLabelType): AnnotationFormatType {
        if (files.length === 0) {
            throw new AnnotationFormatDetectionError(
                'No annotation file was given: the annotations come in .json, .xml or .txt files.'
            );
        }

        const extensions = new Set<string>(files.map((file: File) => AnnotationImportActions.getExtension(file.name)));
        if (extensions.size > 1) {
            throw new AnnotationFormatDetectionError(
                `The files mix several formats (${Array.from(extensions).map((e: string) => '.' + e).join(', ')}). ` +
                'Import one format at a time.'
            );
        }

        const extension: string = extensions.values().next().value;
        if (labelType === LabelType.POLYGON && extension !== 'json') {
            throw new AnnotationFormatDetectionError('Polygons are imported from a COCO JSON file.');
        }

        switch (extension) {
            case 'json':
                if (files.length > 1) {
                    throw new AnnotationFormatDetectionError(
                        'COCO annotations come in a single JSON file, but several were given.'
                    );
                }
                return AnnotationFormatType.COCO;
            case 'xml':
                return AnnotationFormatType.VOC;
            case 'txt':
                if (!files.some((file: File) => file.name === YOLO_LABELS_FILE_NAME)) {
                    throw new AnnotationFormatDetectionError(
                        `YOLO annotations need their ${YOLO_LABELS_FILE_NAME} file along with them.`
                    );
                }
                return AnnotationFormatType.YOLO;
            default:
                throw new AnnotationFormatDetectionError(
                    'Rectangles are imported from VOC XML files, a COCO JSON file, or YOLO text files.'
                );
        }
    }

    // Reads the files, then applies the annotations right away when the project has none yet, or
    // asks first what to do with the current ones.
    public static async importFiles(files: File[], labelType: ImportableLabelType): Promise<void> {
        AnnotationImportActions.pendingImport = null;

        let importedAnnotations: ImportedAnnotations;
        try {
            const formatType = AnnotationImportActions.detectFormat(files, labelType);
            importedAnnotations = await AnnotationImportActions.readFiles(files, labelType, formatType);
        } catch (error) {
            AnnotationImportActions.notifyFailure(error as Error);
            return;
        }

        if (importedAnnotations.labelNames.length === 0) {
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: 'Nothing to import',
                description: `No ${AnnotationImportActions.getLabelTypeName(labelType)} were found in the files.`
            })));
            return;
        }

        if (AnnotationImportActions.projectHasAnnotations(LabelsSelector.getImagesData())) {
            AnnotationImportActions.pendingImport = importedAnnotations;
            store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_ANNOTATIONS));
        } else {
            // Adding to an empty project keeps the labels already created, with their colors
            AnnotationImportActions.applyImport(importedAnnotations, true);
        }
    }

    public static getPendingImport(): ImportedAnnotations | null {
        return AnnotationImportActions.pendingImport;
    }

    public static applyPendingImport(keepCurrentAnnotations: boolean): void {
        const importedAnnotations = AnnotationImportActions.pendingImport;
        AnnotationImportActions.pendingImport = null;
        if (importedAnnotations) {
            AnnotationImportActions.applyImport(importedAnnotations, keepCurrentAnnotations);
        }
    }

    public static discardPendingImport(): void {
        AnnotationImportActions.pendingImport = null;
    }

    // Anything a replacing import would remove: annotations of any type, or image tags
    public static projectHasAnnotations(imagesData: ImageData[]): boolean {
        return imagesData.some((imageData: ImageData) =>
            imageData.labelRects.length > 0 ||
            imageData.labelPolygons.length > 0 ||
            imageData.labelPoints.length > 0 ||
            imageData.labelLines.length > 0 ||
            imageData.labelNameIds.length > 0 ||
            TagUtil.getImageTags(imageData).length > 0
        );
    }

    private static applyImport(importedAnnotations: ImportedAnnotations, keepCurrentAnnotations: boolean): void {
        const { imagesData, labelNames, measurementFunctionByName, tagConfig } = importedAnnotations;

        if (keepCurrentAnnotations) {
            const mergeResult = AnnotationMergeUtil.mergeImportedAnnotations(
                LabelsSelector.getImagesData(),
                LabelsSelector.getLabelNames(),
                GeneralSelector.getMeasurementFunctionByName(),
                imagesData,
                labelNames,
                measurementFunctionByName
            );
            store.dispatch(updateImageData(mergeResult.imagesData));
            store.dispatch(updateLabelNames(mergeResult.labelNames));
            store.dispatch(updateMeasurementFunctions(mergeResult.measurementFunctionByName));
            if (tagConfig !== null) {
                store.dispatch(updateTagConfig(TagUtil.mergeTagConfigs(LabelsSelector.getTagConfig(), tagConfig)));
            }
        } else {
            store.dispatch(updateImageData(imagesData));
            store.dispatch(updateLabelNames(labelNames));
            store.dispatch(updateMeasurementFunctions(measurementFunctionByName));
            if (tagConfig !== null) {
                store.dispatch(updateTagConfig(tagConfig));
            }
        }

        // The project now works with the imported type only
        store.dispatch(updateAnnotationMode(importedAnnotations.labelType));
        AnnotationImportActions.notifySuccess(importedAnnotations);
    }

    private static readFiles(
        files: File[],
        labelType: ImportableLabelType,
        formatType: AnnotationFormatType
    ): Promise<ImportedAnnotations> {
        return new Promise<ImportedAnnotations>((resolve, reject) => {
            const importer = new (ImporterSpecData[formatType])([labelType]);
            importer.import(
                files,
                (
                    imagesData: ImageData[],
                    labelNames: LabelName[],
                    measurementFunctionByName: MeasurementFunctionByName = {},
                    tagConfig?: TagConfig
                ) => resolve({
                    labelType,
                    imagesData,
                    labelNames,
                    measurementFunctionByName,
                    tagConfig: tagConfig ?? null,
                    failedFileNames: []
                }),
                (error?: Error) => {
                    // the files that could be read are still imported
                    if (error instanceof PartialVOCImportError) {
                        resolve({
                            labelType,
                            imagesData: error.imagesData,
                            labelNames: error.labelNames,
                            measurementFunctionByName: {},
                            tagConfig: error.tagConfig ?? null,
                            failedFileNames: error.fileNames
                        });
                    } else {
                        reject(error ?? new Error('The annotations could not be imported.'));
                    }
                }
            );
        });
    }

    private static notifySuccess(importedAnnotations: ImportedAnnotations): void {
        const typeName = AnnotationImportActions.getLabelTypeName(importedAnnotations.labelType);
        const failedCount = importedAnnotations.failedFileNames.length;
        if (failedCount > 0) {
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: `Some ${typeName} not imported`,
                description: `${failedCount} ${failedCount === 1 ? 'file' : 'files'} could not be read: ` +
                    `${importedAnnotations.failedFileNames.join(', ')}. The other files were imported.`
            })));
            return;
        }

        store.dispatch(submitNewNotification(NotificationUtil.createSuccessNotification({
            header: `${typeName.charAt(0).toUpperCase()}${typeName.slice(1)} imported`,
            description: `The ${typeName} from the files were added to the project.`
        })));
    }

    private static notifyFailure(error: Error): void {
        if (error instanceof AnnotationFormatDetectionError) {
            store.dispatch(submitNewNotification(NotificationUtil.createErrorNotification({
                header: 'Annotation format not recognized',
                description: error.message
            })));
            return;
        }

        const content = NotificationsDataMap[AnnotationImportActions.resolveNotification(error)];
        store.dispatch(submitNewNotification(NotificationUtil.createErrorNotification({
            header: content.header,
            description: error?.message ? `${error.message} ${content.description}` : content.description
        })));
    }

    private static resolveNotification(error: Error): Notification {
        if (error instanceof DocumentParsingError) {
            return Notification.ANNOTATION_FILE_PARSE_ERROR;
        }
        if (error instanceof LabelNamesNotUniqueError) {
            return Notification.NON_UNIQUE_LABEL_NAMES_ERROR;
        }
        return Notification.ANNOTATION_IMPORT_ASSERTION_ERROR;
    }

    private static getExtension(fileName: string): string {
        const dotIndex = fileName.lastIndexOf('.');
        return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase();
    }
}
