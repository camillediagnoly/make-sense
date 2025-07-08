import { ISize } from "../../interfaces/ISize";
import { GeneralActionTypes, ProjectData } from "./types";
import { Action } from "../Actions";
import { PopupWindowType } from "../../data/enums/PopupWindowType";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { ContextType } from "../../data/enums/ContextType";


export function updateWindowSize(windowSize: ISize): GeneralActionTypes {
    return {
        type: Action.UPDATE_WINDOW_SIZE,
        payload: {
            windowSize,
        },
    };
}

export function updateActivePopupType(
    activePopupType: PopupWindowType
): GeneralActionTypes {
    return {
        type: Action.UPDATE_ACTIVE_POPUP_TYPE,
        payload: {
            activePopupType,
        },
    };
}

export function updateCustomCursorStyle(
    customCursorStyle: CustomCursorStyle
): GeneralActionTypes {
    return {
        type: Action.UPDATE_CUSTOM_CURSOR_STYLE,
        payload: {
            customCursorStyle,
        },
    };
}

export function updateActiveContext(
    activeContext: ContextType
): GeneralActionTypes {
    return {
        type: Action.UPDATE_CONTEXT,
        payload: {
            activeContext,
        },
    };
}

export function updatePreventCustomCursorStatus(
    preventCustomCursor: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_PREVENT_CUSTOM_CURSOR_STATUS,
        payload: {
            preventCustomCursor,
        },
    };
}

export function updateImageDragModeStatus(
    imageDragMode: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_IMAGE_DRAG_MODE_STATUS,
        payload: {
            imageDragMode,
        },
    };
}

export function updateCrossHairVisibleStatus(
    crossHairVisible: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_CROSS_HAIR_VISIBLE_STATUS,
        payload: {
            crossHairVisible,
        },
    };
}

export function updateFixedZoomStatus(fixedZoom: boolean): GeneralActionTypes {
    return {
        type: Action.UPDATE_FIXED_ZOOM,
        payload: {
            fixedZoom,
        },
    };
}

export function updateEllipseDrawStatus(
    ellipseDraw: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_ELLIPSE_DRAW_STATUS,
        payload: {
            ellipseDraw,
        },
    };
}

export function updateMovingAnnotationStatus(
    movingAnnotation: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_MOVING_ANNOTATION_STATUS,
        payload: {
            movingAnnotation,
        },
    };
}

export function updateCopyPolygonsStatus(
    copyPolygons: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_COPY_POLYGONS_STATUS,
        payload: {
            copyPolygons: copyPolygons,
        },
    };
}

export function updatePasteAnnotationsStatus(
    pastePolygons: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_PASTE_POLYGONS_STATUS,
        payload: {
            pastePolygons,
        },
    };
}

export function updateProjectData(
    projectData: ProjectData
): GeneralActionTypes {
    return {
        type: Action.UPDATE_PROJECT_DATA,
        payload: {
            projectData,
        },
    };
}

export function updateZoom(zoom: number): GeneralActionTypes {
    return {
        type: Action.UPDATE_ZOOM,
        payload: {
            zoom,
        },
    };
}

export function updatePerClassColorationStatus(
    enablePerClassColoration: boolean
): GeneralActionTypes {
    return {
        type: Action.UPDATE_ENABLE_PER_CLASS_COLORATION_STATUS,
        payload: {
            enablePerClassColoration,
        },
    };
}

export function updateKeyboardShortcuts(keyboardShortcuts: ShortcutItem[]): GeneralActionTypes {
    return {
        type: Action.UPDATE_KEYBOARD_SHORTCUTS,
        payload: {
            keyboardShortcuts,
        },
    };
}

export function updateKeyboardShortcut(id: string, keyCombo: string[]): GeneralActionTypes {
    return {
        type: Action.UPDATE_KEYBOARD_SHORTCUT,
        payload: {
            id,
            keyCombo,
        },
    };
}

export function resetKeyboardShortcut(id: string): GeneralActionTypes {
    return {
        type: Action.RESET_KEYBOARD_SHORTCUT,
        payload: {
            id,
        },
    };
}
