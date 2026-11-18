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
import { ReviewSaveState } from './ReviewSaveState';
import { ReviewFolderError } from './ReviewFolderReader';
import { updateActivePopupType } from '../../store/general/actionCreators';
import { PopupWindowType } from '../../data/enums/PopupWindowType';

export type SaveFolderChoice = { chosen: true } | { chosen: false; problem: string | null };

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
        ReviewSaveState.markLoaded(result.imagesData);

        ReviewActions.notifyLoadWarnings(folder, result);
    }

    private static notifyLoadWarnings(folder: ReviewFolder, result: ReviewProjectLoadResult): void {
        const pictures = (count: number) => count > 1 ? `${count} pictures` : '1 picture';
        const example = (names: string[]) => `for example "${names[0]}"`;

        // An already reviewed folder: the review goes on from the reviewed annotations, which saving
        // updates. Stays until closed, so it is not missed.
        const reviewedName = folder.format === 'coco' ? folder.reviewedJsonName : `${folder.reviewedLabelsFolderName}/`;
        const loadedName = folder.format === 'coco' ? folder.jsonFile.name : `${folder.labelsFolderName}/`;
        const originalName = folder.format === 'coco'
            ? folder.skippedJsonName
            : folder.skippedLabelsFolderName && `${folder.skippedLabelsFolderName}/`;
        if (loadedName === reviewedName) {
            store.dispatch(submitNewNotification({...NotificationUtil.createMessageNotification({
                header: 'You already worked on this folder',
                description: `Your previous review ("${reviewedName}") was opened, so you continue where you `
                    + 'stopped. Saving will update it'
                    + (originalName ? `; the original "${originalName}" is not changed.` : '.'),
            }), persistent: true}));
        }

        if (result.missingImageNames.length > 0) {
            const count = result.missingImageNames.length;
            store.dispatch(submitNewNotification({...NotificationUtil.createWarningNotification({
                header: 'Some pictures are missing',
                description: (folder.format === 'coco'
                    ? `${pictures(count)} listed in "${loadedName}" ${count > 1 ? 'are' : 'is'} not in the `
                    : `${count} file${count > 1 ? 's' : ''} of "${loadedName}" describe${count > 1 ? '' : 's'} `
                        + 'pictures that are not in the ')
                    + `"images" folder (${example(result.missingImageNames)}). `
                    + 'They are skipped, and kept as they are when you save.',
            }), persistent: true}));
        }

        if (folder.format === 'voc' && result.imagesWithoutAnnotations.length > 0) {
            const count = result.imagesWithoutAnnotations.length;
            store.dispatch(submitNewNotification({...NotificationUtil.createWarningNotification({
                header: 'Some pictures have no annotations',
                description: `${pictures(count)} of the "images" folder ${count > 1 ? 'have' : 'has'} no file in `
                    + `"${loadedName}" (${example(result.imagesWithoutAnnotations)}). `
                    + `${count > 1 ? 'They are' : 'It is'} shown without annotations.`,
            }), persistent: true}));
        }
    }

    // "Save my review": asks first where to save when the browser does not know the folder yet
    public static async onSaveClick(): Promise<void> {
        if (ReviewProject.needsSaveFolder()) {
            store.dispatch(updateActivePopupType(PopupWindowType.CHOOSE_SAVE_FOLDER));
            return;
        }
        await ReviewActions.exportCurrentFolder();
    }

    // Opens the folder picker: has to be called right from a click
    public static async chooseSaveFolder(): Promise<SaveFolderChoice> {
        try {
            await ReviewProject.chooseSaveFolder();
            return { chosen: true };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return { chosen: false, problem: null };
            }
            return {
                chosen: false,
                problem: error instanceof ReviewFolderError
                    ? error.problems.join(' ')
                    : `This folder could not be used: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    // Saves the review, returns whether it was saved
    public static async exportCurrentFolder(): Promise<boolean> {
        const annotationsName = ReviewProject.getLoadedAnnotationsName();
        try {
            const imagesData = LabelsSelector.getImagesData();
            const result = await ReviewProject.exportReviewedFolder(imagesData);
            ReviewSaveState.markSaved(imagesData);
            if (result.kind === 'folder') {
                store.dispatch(submitNewNotification(NotificationUtil.createSuccessNotification({
                    header: 'Review saved',
                    description: `Your review was saved in "${result.folderName}", as "${result.fileName}"`
                        + (result.fileCount !== undefined ? ` (${result.fileCount} files)` : '')
                        + `. The original "${annotationsName}" is not changed.`,
                })));
            } else {
                store.dispatch(submitNewNotification({...NotificationUtil.createSuccessNotification({
                    header: 'Review downloaded',
                    description: `"${result.fileName}" is in your Downloads folder. Please `
                        + (result.fileCount !== undefined ? 'unzip it' : 'move it')
                        + ` into the folder that holds "${annotationsName}".`,
                }), persistent: true}));
            }
            return true;
        } catch (error) {
            // Closing the folder picker is not an error
            if (error instanceof Error && error.name === 'AbortError') {
                return false;
            }
            store.dispatch(submitNewNotification({...NotificationUtil.createErrorNotification({
                header: 'Your review could not be saved',
                description: error instanceof Error ? error.message : 'The review could not be written.',
            }), persistent: true}));
            return false;
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
        ReviewSaveState.clear();
    }
}
