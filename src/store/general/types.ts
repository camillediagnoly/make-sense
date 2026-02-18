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

export type ImageClassCriteriaMode = 'include' | 'exclude';
export type ImageClassCriteriaOperator = 'and' | 'or';

export type ImageClassCriteria = {
    labelId: string;
    mode: ImageClassCriteriaMode;
    operator: ImageClassCriteriaOperator;
}

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
    imageListFilterMode: ImageFilterMode;
    imageListSearchText: string;
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
    | UpdateImageListFilterMode
    | UpdateImageListSearchText
    | UpdateImageClassCriteria;
