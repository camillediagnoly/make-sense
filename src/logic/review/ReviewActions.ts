import { store } from '../../index';
import { ProjectType } from '../../data/enums/ProjectType';
import { LabelType } from '../../data/enums/LabelType';
import {
    updateActiveImageIndex,
    updateActiveLabelId,
    updateActiveLabelNameId,
    updateActiveLabelType,
    updateFirstLabelCreatedFlag,
    updateHighlightedLabelId,
    updateImageData,
    updateImageDataById,
    updateLabelNames,
    updateTagConfig,
} from '../../store/labels/actionCreators';
import { updateMeasurementFunctions, updateProjectData } from '../../store/general/actionCreators';
import { submitNewNotification } from '../../store/notifications/actionCreators';
import { NotificationUtil } from '../../utils/NotificationUtil';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { Annotation, ImageData } from '../../store/labels/types';
import { LocalImageDirectoryRegistry } from '../imageRepository/LocalImageDirectoryRegistry';
import { ReviewFolder } from './ReviewFolderReader';
import { ReviewProject, ReviewProjectLoadResult } from './ReviewProject';

export class ReviewActions {
    public static async startProject(folder: ReviewFolder): Promise<void> {
        const result = await ReviewProject.load(folder);

        store.dispatch(updateLabelNames(result.labelNames));
        store.dispatch(updateTagConfig({ tags: [], groupNames: [] }));
        store.dispatch(updateMeasurementFunctions(result.measurementFunctionByName));
        store.dispatch(updateActiveLabelType(LabelType.POLYGON));
        store.dispatch(updateActiveLabelNameId(null));
        store.dispatch(updateImageData(result.imagesData));
        store.dispatch(updateActiveImageIndex(0));
        store.dispatch(updateProjectData({ type: ProjectType.OBJECT_DETECTION, name: folder.name }));

        ReviewActions.notifyLoadWarnings(folder, result);
    }

    private static notifyLoadWarnings(folder: ReviewFolder, result: ReviewProjectLoadResult): void {
        const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;
        const example = (names: string[]) => `e.g. "${names[0]}"`;

        // An already exported folder: the review goes on from the reviewed annotations, which the
        // next export overwrites
        if (folder.format === 'coco' && folder.jsonFile.name === folder.reviewedJsonName) {
            store.dispatch(submitNewNotification({...NotificationUtil.createWarningNotification({
                header: `"${folder.reviewedJsonName}" was loaded`,
                description: (folder.skippedJsonName
                    ? `This folder was already reviewed: "${folder.reviewedJsonName}" was picked over `
                        + `the original "${folder.skippedJsonName}", which stays untouched. `
                    : `This folder was already reviewed. `)
                    + `"Export current folder" will overwrite "${folder.reviewedJsonName}".`,
            }), displayTimeMs: 15000}));
        }
        if (folder.format === 'voc' && folder.labelsFolderName === folder.reviewedLabelsFolderName) {
            store.dispatch(submitNewNotification({...NotificationUtil.createWarningNotification({
                header: `"${folder.reviewedLabelsFolderName}" was loaded`,
                description: (folder.skippedLabelsFolderName
                    ? `This folder was already reviewed: "${folder.reviewedLabelsFolderName}/" was picked `
                        + `over the original "${folder.skippedLabelsFolderName}/", which stays untouched. `
                    : `This folder was already reviewed. `)
                    + `"Export current folder" will overwrite the files of "${folder.reviewedLabelsFolderName}/".`,
            }), displayTimeMs: 15000}));
        }

        if (result.missingImageNames.length > 0) {
            const count = result.missingImageNames.length;
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: `${plural(count, 'image')} not found`,
                description: folder.format === 'coco'
                    ? `The .json file describes ${plural(count, 'image')} that the images folder does not `
                        + `hold (${example(result.missingImageNames)}). Their annotations are not shown, and `
                        + 'are written unchanged on export.'
                    : `${plural(count, '.xml file')} of "${folder.labelsFolderName}/" describe${count > 1 ? '' : 's'} `
                        + `an image that the images folder does not hold (${example(result.missingImageNames)}). `
                        + `${count > 1 ? 'They are' : 'It is'} not shown, and copied unchanged on export.`,
            })));
        }

        if (folder.format === 'voc' && result.imagesWithoutAnnotations.length > 0) {
            const count = result.imagesWithoutAnnotations.length;
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: `${plural(count, 'image')} without .xml file`,
                description: `${plural(count, 'image')} of the images folder ha${count > 1 ? 've' : 's'} no .xml `
                    + `file in "${folder.labelsFolderName}/" (${example(result.imagesWithoutAnnotations)}). `
                    + `${count > 1 ? 'They are' : 'It is'} shown without annotations, and no .xml file is `
                    + 'written for them on export.',
            })));
        }
    }

    public static async exportCurrentFolder(): Promise<void> {
        try {
            const result = await ReviewProject.exportReviewedFolder(LabelsSelector.getImagesData());
            store.dispatch(submitNewNotification(NotificationUtil.createSuccessNotification({
                header: 'Folder exported',
                description: result.kind === 'folder'
                    ? `The reviewed annotations were saved in "${result.folderName}/${result.fileName}"`
                        + (result.fileCount !== undefined ? ` (${result.fileCount} .xml files).` : '.')
                    : result.fileCount !== undefined
                        ? `"${result.fileName}" was downloaded: unzip it into the reviewed folder.`
                        : `"${result.fileName}" was downloaded: move it into the reviewed folder.`,
            })));
        } catch (error) {
            // Closing the folder picker is not an error
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            store.dispatch(submitNewNotification(NotificationUtil.createErrorNotification({
                header: 'Export failed',
                description: error instanceof Error ? error.message : 'The reviewed folder could not be written.',
            })));
        }
    }

    // Deleting only moves the annotation to the "deleted annotations" list: it is not drawn nor
    // moved anymore, is exported with a "<category>_deleted" category (.json) or a "<name>_deleted"
    // name (.xml), and can be re-added
    public static setAnnotationDeleted(labelId: string, isDeleted: boolean): void {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        if (!imageData) {
            return;
        }
        const labelIds: string[] = ReviewProject.getAnnotationLabelIds(labelId);
        const update = <T extends Annotation>(annotation: T): T =>
            labelIds.includes(annotation.id) ? { ...annotation, isDeleted } : annotation;
        store.dispatch(updateImageDataById(imageData.id, {
            ...imageData,
            labelRects: imageData.labelRects.map(update),
            labelPolygons: imageData.labelPolygons.map(update),
        }));
        if (isDeleted && labelIds.includes(LabelsSelector.getActiveLabelId())) {
            store.dispatch(updateActiveLabelId(null));
        }
        if (labelIds.includes(LabelsSelector.getHighlightedLabelId())) {
            store.dispatch(updateHighlightedLabelId(null));
        }
    }

    public static closeProject(): void {
        store.dispatch(updateActiveLabelId(null));
        store.dispatch(updateHighlightedLabelId(null));
        store.dispatch(updateActiveLabelNameId(null));
        store.dispatch(updateLabelNames([]));
        store.dispatch(updateTagConfig({ tags: [], groupNames: [] }));
        store.dispatch(updateMeasurementFunctions({}));
        store.dispatch(updateProjectData({ type: null, name: '' }));
        store.dispatch(updateActiveImageIndex(null));
        store.dispatch(updateImageData([]));
        store.dispatch(updateFirstLabelCreatedFlag(false));
        LocalImageDirectoryRegistry.clear();
        ReviewProject.clear();
    }
}
