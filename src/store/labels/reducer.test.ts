import { Action } from '../Actions';
import { LabelUtil } from '../../utils/LabelUtil';
import {
    addImageData,
    deleteImageDataById,
    redoActiveImageAction,
    undoActiveImageAction,
    updateActiveImageIndex,
    updateImageDataById,
} from './actionCreators';
import { labelsReducer } from './reducer';
import { ImageData } from './types';

const createImageData = (id: string, loadStatus = true): ImageData => ({
    id,
    fileData: new File([''], `${id}.jpg`, { type: 'image/jpeg' }),
    loadStatus,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    imgWidth: 100,
    imgHeight: 100,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const initializeState = (imagesData: ImageData[], activeImageIndex = 0) => {
    const initialState = labelsReducer(undefined, { type: Action.UPDATE_LABEL_NAMES, payload: { labels: [] } });
    const stateWithImages = labelsReducer(initialState, addImageData(imagesData));
    return labelsReducer(stateWithImages, updateActiveImageIndex(activeImageIndex));
};

describe('labelsReducer image history', () => {
    it('undoes and redoes changes on the active image', () => {
        const imageData = createImageData('image-1');
        const state = initializeState([imageData]);
        const imageDataWithRect = {
            ...imageData,
            labelRects: [LabelUtil.createLabelRect('label-id', { x: 1, y: 2, width: 3, height: 4 })],
        };

        const editedState = labelsReducer(state, updateImageDataById(imageData.id, imageDataWithRect));
        const undoneState = labelsReducer(editedState, undoActiveImageAction());
        const redoneState = labelsReducer(undoneState, redoActiveImageAction());

        expect(editedState.imageDataHistory.past).toHaveLength(1);
        expect(undoneState.imagesData[0].labelRects).toHaveLength(0);
        expect(undoneState.imageDataHistory.future).toHaveLength(1);
        expect(redoneState.imagesData[0].labelRects).toHaveLength(1);
    });

    it('clears active image history when moving to another image', () => {
        const imageData = createImageData('image-1');
        const nextImageData = createImageData('image-2');
        const state = initializeState([imageData, nextImageData]);
        const imageDataWithRect = {
            ...imageData,
            labelRects: [LabelUtil.createLabelRect('label-id', { x: 1, y: 2, width: 3, height: 4 })],
        };

        const editedState = labelsReducer(state, updateImageDataById(imageData.id, imageDataWithRect));
        const movedState = labelsReducer(editedState, updateActiveImageIndex(1));
        const undoAfterMoveState = labelsReducer(movedState, undoActiveImageAction());

        expect(movedState.imageDataHistory.past).toHaveLength(0);
        expect(movedState.imageDataHistory.future).toHaveLength(0);
        expect(movedState.imageDataHistory.imageId).toBeNull();
        expect(undoAfterMoveState.imagesData[0].labelRects).toHaveLength(1);
    });

    it('does not record image load status changes as undoable actions', () => {
        const imageData = createImageData('image-1', false);
        const state = initializeState([imageData]);

        const loadedState = labelsReducer(
            state,
            updateImageDataById(imageData.id, { ...imageData, loadStatus: true })
        );

        expect(loadedState.imageDataHistory.past).toHaveLength(0);
        expect(loadedState.imagesData[0].loadStatus).toBe(true);
    });
});


describe('labelsReducer image deletion', () => {
    it('removes an active image and selects the next available image', () => {
        const firstImage = createImageData('image-1');
        const secondImage = createImageData('image-2');
        const state = initializeState([firstImage, secondImage]);

        const nextState = labelsReducer(state, deleteImageDataById(firstImage.id));

        expect(nextState.imagesData).toHaveLength(1);
        expect(nextState.imagesData[0].id).toBe(secondImage.id);
        expect(nextState.activeImageIndex).toBe(0);
        expect(nextState.activeLabelId).toBeNull();
        expect(nextState.imageDataHistory.imageId).toBeNull();
    });

    it('clears the active image when the last image is removed', () => {
        const imageData = createImageData('image-1');
        const state = initializeState([imageData]);

        const nextState = labelsReducer(state, deleteImageDataById(imageData.id));

        expect(nextState.imagesData).toHaveLength(0);
        expect(nextState.activeImageIndex).toBeNull();
    });
});
