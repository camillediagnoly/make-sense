import { isEqual } from 'lodash';
import {LabelsActionTypes, LabelsState, ImageData, LabelName, ImageDataHistory} from './types';
import {Action} from '../Actions';
import {ImageDataUtil} from '../../utils/ImageDataUtil';

type UndoableImageData = Pick<
    ImageData,
    'labelRects' | 'labelPoints' | 'labelLines' | 'labelPolygons' | 'labelNameIds'
>;

const createEmptyImageDataHistory = (): ImageDataHistory => ({
    imageId: null,
    past: [],
    future: [],
});

const initialState: LabelsState = {
    activeImageIndex: null,
    activeLabelNameId: null,
    activeLabelType: null,
    activeLabelId: null,
    highlightedLabelId: null,
    imagesData: [],
    imageDataHistory: createEmptyImageDataHistory(),
    firstLabelCreatedFlag: false,
    labels: []
};

const getActiveImageData = (state: LabelsState): ImageData | null => {
    if (state.activeImageIndex === null || state.activeImageIndex === undefined) {
        return null;
    }

    return state.imagesData[state.activeImageIndex] || null;
};

const getImageDataById = (imagesData: ImageData[], imageId: string): ImageData | null => {
    return imagesData.find((imageData: ImageData) => imageData.id === imageId) || null;
};

const replaceImageDataById = (
    imagesData: ImageData[],
    imageId: string,
    nextImageData: ImageData
): ImageData[] => {
    const nextImageDataCopy = ImageDataUtil.cloneImageData(nextImageData);
    return imagesData.map((imageData: ImageData) =>
        imageData.id === imageId ? nextImageDataCopy : imageData
    );
};

const getUndoableImageData = (imageData: ImageData): UndoableImageData => ({
    labelRects: imageData.labelRects,
    labelPoints: imageData.labelPoints,
    labelLines: imageData.labelLines,
    labelPolygons: imageData.labelPolygons,
    labelNameIds: imageData.labelNameIds,
});

const hasUndoableImageDataChange = (
    previousImageData: ImageData | null,
    nextImageData: ImageData | null
): boolean => {
    if (!previousImageData || !nextImageData) {
        return false;
    }

    return !isEqual(
        getUndoableImageData(previousImageData),
        getUndoableImageData(nextImageData)
    );
};

const getNextImageDataHistory = (
    state: LabelsState,
    imageId: string,
    previousImageData: ImageData | null,
    nextImageData: ImageData
): ImageDataHistory => {
    const activeImageData = getActiveImageData(state);

    if (!activeImageData || activeImageData.id !== imageId) {
        return state.imageDataHistory;
    }

    if (!hasUndoableImageDataChange(previousImageData, nextImageData)) {
        return state.imageDataHistory;
    }

    const past = state.imageDataHistory.imageId === imageId
        ? state.imageDataHistory.past
        : [];

    return {
        imageId,
        past: past.concat(ImageDataUtil.cloneImageData(previousImageData)),
        future: [],
    };
};

export function labelsReducer(
    state = initialState,
    action: LabelsActionTypes
): LabelsState {
    switch (action.type) {
        case Action.UPDATE_ACTIVE_IMAGE_INDEX: {
            const shouldClearHistory = state.activeImageIndex !== action.payload.activeImageIndex;
            return {
                ...state,
                activeImageIndex: action.payload.activeImageIndex,
                imageDataHistory: shouldClearHistory
                    ? createEmptyImageDataHistory()
                    : state.imageDataHistory,
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_NAME_ID: {
            return {
                ...state,
                activeLabelNameId: action.payload.activeLabelNameId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_ID: {
            return {
                ...state,
                activeLabelId: action.payload.activeLabelId
            }
        }
        case Action.UPDATE_HIGHLIGHTED_LABEL_ID: {
            return {
                ...state,
                highlightedLabelId: action.payload.highlightedLabelId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_TYPE: {
            return {
                ...state,
                activeLabelType: action.payload.activeLabelType
            }
        }
        case Action.UPDATE_IMAGE_DATA_BY_ID: {
            const nextImageData = ImageDataUtil.cloneImageData(action.payload.newImageData);
            const previousImageData = getImageDataById(state.imagesData, action.payload.id);

            return {
                ...state,
                imagesData: replaceImageDataById(state.imagesData, action.payload.id, nextImageData),
                imageDataHistory: getNextImageDataHistory(
                    state,
                    action.payload.id,
                    previousImageData,
                    nextImageData
                ),
            }
        }
        case Action.ADD_IMAGES_DATA: {
            return {
                ...state,
                imagesData: state.imagesData.concat(
                    ImageDataUtil.cloneImagesData(action.payload.imageData)
                )
            }
        }
        case Action.UPDATE_IMAGES_DATA: {
            const nextImagesData = ImageDataUtil.cloneImagesData(action.payload.imageData);
            const activeImageData = getActiveImageData(state);
            const nextActiveImageData = activeImageData
                ? getImageDataById(nextImagesData, activeImageData.id)
                : null;

            return {
                ...state,
                imagesData: nextImagesData,
                imageDataHistory: activeImageData && nextActiveImageData
                    ? getNextImageDataHistory(
                        state,
                        activeImageData.id,
                        activeImageData,
                        nextActiveImageData
                    )
                    : createEmptyImageDataHistory(),
            }
        }
        case Action.UPDATE_LABEL_NAMES: {
            return {
                ...state,
                labels: action.payload.labels
            }
        }
        case Action.UPDATE_LABEL_VISIBILITY: {
            return {
                ...state,
                labels: state.labels.map((label: LabelName) =>
                    label.id === action.payload.labelId
                        ? { ...label, isVisible: action.payload.isVisible }
                        : label
                ),
            };
        }
        case Action.UPDATE_FIRST_LABEL_CREATED_FLAG: {
            return {
                ...state,
                firstLabelCreatedFlag: action.payload.firstLabelCreatedFlag
            }
        }
        case Action.UNDO_ACTIVE_IMAGE_ACTION: {
            const activeImageData = getActiveImageData(state);

            if (
                !activeImageData ||
                state.imageDataHistory.imageId !== activeImageData.id ||
                state.imageDataHistory.past.length === 0
            ) {
                return state;
            }

            const previousImageData = state.imageDataHistory.past[state.imageDataHistory.past.length - 1];
            const nextPast = state.imageDataHistory.past.slice(0, -1);
            const nextFuture = [
                ImageDataUtil.cloneImageData(activeImageData),
                ...state.imageDataHistory.future,
            ];

            return {
                ...state,
                activeLabelId: null,
                highlightedLabelId: null,
                imagesData: replaceImageDataById(state.imagesData, activeImageData.id, previousImageData),
                imageDataHistory: {
                    imageId: activeImageData.id,
                    past: nextPast,
                    future: nextFuture,
                },
            };
        }
        case Action.REDO_ACTIVE_IMAGE_ACTION: {
            const activeImageData = getActiveImageData(state);

            if (
                !activeImageData ||
                state.imageDataHistory.imageId !== activeImageData.id ||
                state.imageDataHistory.future.length === 0
            ) {
                return state;
            }

            const nextImageData = state.imageDataHistory.future[0];
            const nextFuture = state.imageDataHistory.future.slice(1);
            const nextPast = state.imageDataHistory.past.concat(
                ImageDataUtil.cloneImageData(activeImageData)
            );

            return {
                ...state,
                activeLabelId: null,
                highlightedLabelId: null,
                imagesData: replaceImageDataById(state.imagesData, activeImageData.id, nextImageData),
                imageDataHistory: {
                    imageId: activeImageData.id,
                    past: nextPast,
                    future: nextFuture,
                },
            };
        }
        default:
            return state;
    }
}
