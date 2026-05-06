import { ISize } from "../../interfaces/ISize";
import { Action } from "../Actions";
import { PopupWindowType } from "../../data/enums/PopupWindowType";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { ContextType } from "../../data/enums/ContextType";
import { ProjectType } from "../../data/enums/ProjectType";
import { ImageFilterMode } from "../../data/enums/ImageFilterMode";

export type ProjectData = {
    type: ProjectType;
    name: string;
};

export type ShortcutItem = {
    id: string;
    name: string;
    keyCombo: string[];
    defaultKeyCombo: string[];
	description?: string;
}

export type ImageClassBooleanOperator = 'AND' | 'OR' | 'NOT';
export type ImageClassParenthesis = '(' | ')';

export type ImageClassExpressionCriteria =
    | {
        id?: string;
        type: 'label';
        labelId: string;
    }
    | {
        id?: string;
        type: 'otherLabels';
    }
    | {
        id?: string;
        type: 'operator';
        operator: ImageClassBooleanOperator;
    }
    | {
        id?: string;
        type: 'parenthesis';
        value: ImageClassParenthesis;
    };

export type LegacyImageClassCriteriaMode = 'include' | 'exclude';
export type LegacyImageClassCriteriaOperator = 'and' | 'or';

export type LegacyImageClassCriteria = {
    labelId: string;
    mode: LegacyImageClassCriteriaMode;
    operator: LegacyImageClassCriteriaOperator;
}

export type ImageClassCriteria = ImageClassExpressionCriteria | LegacyImageClassCriteria;

export type GeneralState = {
    windowSize: ISize;
    activePopupType: PopupWindowType;
    customCursorStyle: CustomCursorStyle;
    preventCustomCursor: boolean;
    imageDragMode: boolean;
    crossHairVisible: boolean;
    fixedZoom: boolean;
    ellipseDraw: boolean;
    movingAnnotation: boolean;
    copyPolygons: boolean;
    pastePolygons: boolean;
    enablePerClassColoration: boolean;
    activeContext: ContextType;
    projectData: ProjectData;
    zoom: number;
    keyboardShortcuts: ShortcutItem[];
    polygonLassoMode: boolean;
    polygonLassoTargetVertexCount: number;
    lineKeypointMode: boolean;
    imageListFilterMode: ImageFilterMode;
    imageListSearchText: string;
    keepLabeledInUnlabeled: boolean;
    keptUnlabeledImageIds: string[];
    imageClassCriteria: ImageClassCriteria[];
};

interface UpdateProjectData {
    type: typeof Action.UPDATE_PROJECT_DATA;
    payload: {
        projectData: ProjectData;
    };
}

interface UpdateWindowSize {
    type: typeof Action.UPDATE_WINDOW_SIZE;
    payload: {
        windowSize: ISize;
    };
}

interface UpdateActivePopupType {
    type: typeof Action.UPDATE_ACTIVE_POPUP_TYPE;
    payload: {
        activePopupType: PopupWindowType;
    };
}

interface UpdateCustomCursorStyle {
    type: typeof Action.UPDATE_CUSTOM_CURSOR_STYLE;
    payload: {
        customCursorStyle: CustomCursorStyle;
    };
}

interface UpdateActiveContext {
    type: typeof Action.UPDATE_CONTEXT;
    payload: {
        activeContext: ContextType;
    };
}

interface UpdatePreventCustomCursorStatus {
    type: typeof Action.UPDATE_PREVENT_CUSTOM_CURSOR_STATUS;
    payload: {
        preventCustomCursor: boolean;
    };
}

interface UpdateImageDragModeStatus {
    type: typeof Action.UPDATE_IMAGE_DRAG_MODE_STATUS;
    payload: {
        imageDragMode: boolean;
    };
}

interface UpdateCrossHairVisibleStatus {
    type: typeof Action.UPDATE_CROSS_HAIR_VISIBLE_STATUS;
    payload: {
        crossHairVisible: boolean;
    };
}

interface UpdateFixedZoomStatus {
    type: typeof Action.UPDATE_FIXED_ZOOM;
    payload: {
        fixedZoom: boolean;
    };
}

interface UpdateEllipseDrawStatus {
    type: typeof Action.UPDATE_ELLIPSE_DRAW_STATUS;
    payload: {
        ellipseDraw: boolean;
    };
}

interface UpdateMovingAnnotationStatus {
    type: typeof Action.UPDATE_MOVING_ANNOTATION_STATUS;
    payload: {
        movingAnnotation: boolean;
    };
}
interface UpdateCopyPolygonsStatus {
    type: typeof Action.UPDATE_COPY_POLYGONS_STATUS;
    payload: {
        copyPolygons: boolean;
    };
}

interface UpdatePastePolygonsStatus {
    type: typeof Action.UPDATE_PASTE_POLYGONS_STATUS;
    payload: {
        pastePolygons: boolean;
    };
}

interface UpdateZoom {
    type: typeof Action.UPDATE_ZOOM;
    payload: {
        zoom: number;
    };
}

interface UpdatePerClassColoration {
    type: typeof Action.UPDATE_ENABLE_PER_CLASS_COLORATION_STATUS;
    payload: {
        enablePerClassColoration: boolean;
    };
}

interface UpdatePolygonDrawMode {
    type: typeof Action.UPDATE_POLYGON_DRAW_MODE;
    payload: {
        polygonLassoMode: boolean;
    };
}

interface UpdatePolygonLassoTargetVertexCount {
    type: typeof Action.UPDATE_POLYGON_LASSO_TARGET_VERTEX_COUNT;
    payload: {
        polygonLassoTargetVertexCount: number;
    };
}

interface UpdateLineKeypointMode {
    type: typeof Action.UPDATE_LINE_KEYPOINT_MODE;
    payload: {
        lineKeypointMode: boolean;
    };
}

interface UpdateImageListFilterMode {
    type: typeof Action.UPDATE_IMAGE_LIST_FILTER_MODE;
    payload: {
        imageListFilterMode: ImageFilterMode;
    };
}

interface UpdateImageListSearchText {
    type: typeof Action.UPDATE_IMAGE_LIST_SEARCH_TEXT;
    payload: {
        imageListSearchText: string;
    };
}

interface UpdateKeepLabeledInUnlabeled {
    type: typeof Action.UPDATE_KEEP_LABELED_IN_UNLABELED;
    payload: {
        keepLabeledInUnlabeled: boolean;
        keptUnlabeledImageIds: string[];
    };
}

interface UpdateImageClassCriteria {
    type: typeof Action.UPDATE_IMAGE_CLASS_CRITERIA;
    payload: {
        imageClassCriteria: ImageClassCriteria[];
    };
}

interface UpdateKeyboardShortcuts {
    type: typeof Action.UPDATE_KEYBOARD_SHORTCUTS;
    payload: {
        keyboardShortcuts: ShortcutItem[];
    }
}

interface UpdateKeyboardShortcut {
    type: typeof Action.UPDATE_KEYBOARD_SHORTCUT;
    payload: {
        id: string;
        keyCombo: string[];
    }
}

export interface ResetKeyboardShortcutAction {
    type: Action.RESET_KEYBOARD_SHORTCUT;
    payload: {
        id: string;
    };
}

export type GeneralActionTypes =
    | UpdateProjectData
    | UpdateWindowSize
    | UpdateActivePopupType
    | UpdateCustomCursorStyle
    | UpdateActiveContext
    | UpdatePreventCustomCursorStatus
    | UpdateImageDragModeStatus
    | UpdateCrossHairVisibleStatus
    | UpdateEllipseDrawStatus
    | UpdateMovingAnnotationStatus
    | UpdateCopyPolygonsStatus
    | UpdatePastePolygonsStatus
    | UpdateFixedZoomStatus
    | UpdateZoom
    | UpdatePerClassColoration
    | UpdateKeyboardShortcuts
    | UpdateKeyboardShortcut
    | ResetKeyboardShortcutAction
    | UpdatePolygonDrawMode
    | UpdatePolygonLassoTargetVertexCount
    | UpdateLineKeypointMode
    | UpdateImageListFilterMode
    | UpdateImageListSearchText
    | UpdateKeepLabeledInUnlabeled
    | UpdateImageClassCriteria;
