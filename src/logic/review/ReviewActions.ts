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
import { ReviewProject } from './ReviewProject';

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

        // An already exported folder: the review goes on from the reviewed file, which the next
        // export overwrites
        if (folder.jsonFile.name === folder.reviewedJsonName) {
            store.dispatch(submitNewNotification({...NotificationUtil.createWarningNotification({
                header: `"${folder.reviewedJsonName}" was loaded`,
                description: (folder.skippedJsonName
                    ? `This folder was already reviewed: "${folder.reviewedJsonName}" was picked over `
                        + `the original "${folder.skippedJsonName}", which stays untouched. `
                    : `This folder was already reviewed. `)
                    + `"Export current folder" will overwrite "${folder.reviewedJsonName}".`,
            }), displayTimeMs: 15000}));
        }

        if (result.missingImageNames.length > 0) {
            const count = result.missingImageNames.length;
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: `${count} image${count > 1 ? 's' : ''} not found`,
                description: `The .json file describes ${count} image${count > 1 ? 's' : ''} that the images `
                    + `folder does not hold (e.g. "${result.missingImageNames[0]}"). Their annotations are `
                    + 'not shown, and are written unchanged on export.',
            })));
        }
    }

    public static async exportCurrentFolder(): Promise<void> {
        try {
            const result = await ReviewProject.exportReviewedFolder(LabelsSelector.getImagesData());
            store.dispatch(submitNewNotification(NotificationUtil.createSuccessNotification({
                header: 'Folder exported',
                description: result.kind === 'folder'
                    ? `The reviewed annotations were saved in "${result.folderName}/${result.fileName}".`
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
    // moved anymore, is exported with a "<category>_deleted" category, and can be re-added
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
