import {IRect} from '../../interfaces/IRect';
import {Action} from '../Actions';
import {LabelType} from '../../data/enums/LabelType';
import {IPoint} from '../../interfaces/IPoint';
import {LabelStatus} from '../../data/enums/LabelStatus';
import {ILine} from '../../interfaces/ILine';
import {
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from '../../interfaces/IFileSystemAccess';

export type Annotation = {
    id: string;
    labelId: string | null;
    isVisible: boolean;
}

export type LabelRect = Annotation & {
    rect: IRect;
    isCreatedByAI: boolean;
    status: LabelStatus;
    suggestedLabel: string;
}

export type LabelPoint = Annotation & {
    point: IPoint;
    isCreatedByAI: boolean;
    status: LabelStatus;
    suggestedLabel: string;
}

export type LabelPolygon = Annotation & {
    vertices: IPoint[];
}

export type LabelLine = Annotation & {
    line: ILine;
}

export type LabelName = {
    name: string;
    id: string;
    color?: string;
    isVisible?: boolean;
}

export type ImageData = {
    id: string;
    fileData: File;
    fileHandle?: LocalFileSystemFileHandle;
    directoryHandle?: LocalFileSystemDirectoryHandle;
    directoryId?: string;
    groupName?: string;
    loadStatus: boolean;
    labelRects: LabelRect[];
    labelPoints: LabelPoint[];
    labelLines: LabelLine[];
    labelPolygons: LabelPolygon[];
    labelNameIds: string[];
    imgWidth?: number;
    imgHeight?: number;

    // YOLO
    isVisitedByYOLOObjectDetector: boolean;

    // SSD
    isVisitedBySSDObjectDetector: boolean;

    // POSE NET
    isVisitedByPoseDetector: boolean;

    // ROBOFLOW API
    isVisitedByRoboflowAPI: boolean;
}

export type ImageDataHistory = {
    imageId: string | null;
    past: ImageData[];
    future: ImageData[];
}

export type LabelsState = {
    activeImageIndex: number | null;
    activeLabelNameId: string;
    activeLabelType: LabelType;
    activeLabelId: string | null;
    highlightedLabelId: string;
    imagesData: ImageData[];
    imageDataHistory: ImageDataHistory;
    firstLabelCreatedFlag: boolean;
    labels: LabelName[];
}

interface UpdateActiveImageIndex {
    type: typeof Action.UPDATE_ACTIVE_IMAGE_INDEX;
    payload: {
        activeImageIndex: number | null;
    }
}

interface UpdateActiveLabelNameId {
    type: typeof Action.UPDATE_ACTIVE_LABEL_NAME_ID;
    payload: {
        activeLabelNameId: string;
    }
}

interface UpdateActiveLabelId {
    type: typeof Action.UPDATE_ACTIVE_LABEL_ID;
    payload: {
        activeLabelId: string;
    }
}

interface UpdateHighlightedLabelId {
    type: typeof Action.UPDATE_HIGHLIGHTED_LABEL_ID;
    payload: {
        highlightedLabelId: string;
    }
}

interface UpdateActiveLabelType {
    type: typeof Action.UPDATE_ACTIVE_LABEL_TYPE;
    payload: {
        activeLabelType: LabelType;
    }
}

interface UpdateImageDataById {
    type: typeof Action.UPDATE_IMAGE_DATA_BY_ID;
    payload: {
        id: string;
        newImageData: ImageData;
    }
}

interface AddImageData {
    type: typeof Action.ADD_IMAGES_DATA;
    payload: {
        imageData: ImageData[];
    }
}

interface UpdateImageData {
    type: typeof Action.UPDATE_IMAGES_DATA;
    payload: {
        imageData: ImageData[];
    }
}

interface DeleteImageDataById {
    type: typeof Action.DELETE_IMAGE_DATA_BY_ID;
    payload: {
        id: string;
    }
}

interface UpdateLabelNames {
    type: typeof Action.UPDATE_LABEL_NAMES;
    payload: {
        labels: LabelName[];
    }
}

interface UpdateFirstLabelCreatedFlag {
    type: typeof Action.UPDATE_FIRST_LABEL_CREATED_FLAG;
    payload: {
        firstLabelCreatedFlag: boolean;
    }
}

interface UpdateLabelVisibility {
    type: typeof Action.UPDATE_LABEL_VISIBILITY;
    payload: {
        labelId: string;
        isVisible: boolean;
    }
}

interface UndoActiveImageAction {
    type: typeof Action.UNDO_ACTIVE_IMAGE_ACTION;
}

interface RedoActiveImageAction {
    type: typeof Action.REDO_ACTIVE_IMAGE_ACTION;
}

export type LabelsActionTypes = UpdateActiveImageIndex
    | UpdateActiveLabelNameId
    | UpdateActiveLabelType
    | UpdateImageDataById
    | AddImageData
    | UpdateImageData
    | DeleteImageDataById
    | UpdateLabelNames
    | UpdateActiveLabelId
    | UpdateHighlightedLabelId
    | UpdateFirstLabelCreatedFlag
    | UpdateLabelVisibility
    | UndoActiveImageAction
    | RedoActiveImageAction
