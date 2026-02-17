import { GeneralActionTypes, GeneralState } from "./types";
import { Action } from "../Actions";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { ViewPointSettings } from "../../settings/ViewPointSettings";
import { PlatformUtil } from "../../utils/PlatformUtil";
import { ImageFilterMode } from "../../data/enums/ImageFilterMode";

const initialState: GeneralState = {
    windowSize: null,
    activePopupType: null,
    customCursorStyle: CustomCursorStyle.DEFAULT,
    activeContext: null,
    preventCustomCursor: false,
    imageDragMode: false,
    crossHairVisible: true,
    fixedZoom: true,
    ellipseDraw: false,
    movingAnnotation: false,
    copyPolygons: false,
    pastePolygons: false,
    enablePerClassColoration: true,
    projectData: {
        type: null,
        name: "my-project-name",
    },
    zoom: ViewPointSettings.MIN_ZOOM,
    polygonLassoMode: false,
    imageListFilterMode: ImageFilterMode.ALL,
    imageListSearchText: "",
    imageClassCriteria: [],
    keyboardShortcuts: [
        {
            id: "finish-polygon-creation",
            name: "Finish Polygon Creation",
            keyCombo: [" "],
            defaultKeyCombo: [" "],
            description: "Completes polygon creation and adds the label",
        },
        {
            id: "cancel-label-creation",
            name: "Cancel Label Creation",
            keyCombo: ["Escape"],
            defaultKeyCombo: ["Escape"],
            description: "Cancels current label creation",
        },
        {
            id: "undo-last-point",
            name: "Undo Last Point",
            keyCombo: ["Control", "z"],
            defaultKeyCombo: ["Control", "z"],
            description: "Removes the last added point in polygon creation",
        },
        {
            id: "toggle-labels-visibility",
            name: "Toggle Labels Visibility",
            keyCombo: PlatformUtil.isMac() ? ["Option", "z"] : ["e"],
            defaultKeyCombo: PlatformUtil.isMac() ? ["Option", "z"] : ["e"],
            description: "Shows or hides all labels in the current image",
        },
        {
            id: "previous-image",
            name: "Previous Image",
            keyCombo: PlatformUtil.isMac() ? ["Alt", "ArrowLeft"] : ["a"],
            defaultKeyCombo: PlatformUtil.isMac()
                ? ["Alt", "ArrowLeft"]
                : ["a"],
            description: "Navigate to the previous image",
        },
        {
            id: "next-image",
            name: "Next Image",
            keyCombo: PlatformUtil.isMac() ? ["Alt", "ArrowRight"] : ["d"],
            defaultKeyCombo: PlatformUtil.isMac()
                ? ["Alt", "ArrowRight"]
                : ["d"],
            description: "Navigate to the next image",
        },
        {
            id: "zoom-in",
            name: "Zoom In",
            keyCombo: PlatformUtil.isMac() ? ["Alt", "+"] : ["Control", "+"],
            defaultKeyCombo: PlatformUtil.isMac()
                ? ["Alt", "+"]
                : ["Control", "+"],
            description: "Increase zoom level",
        },
        {
            id: "zoom-out",
            name: "Zoom Out",
            keyCombo: PlatformUtil.isMac() ? ["Alt", "-"] : ["Control", "-"],
            defaultKeyCombo: PlatformUtil.isMac()
                ? ["Alt", "-"]
                : ["Control", "-"],
            description: "Decrease zoom level",
        },
        {
            id: "move-right",
            name: "Move Right",
            keyCombo: ["ArrowRight"],
            defaultKeyCombo: ["ArrowRight"],
            description: "Move viewport to the right",
        },
        {
            id: "move-left",
            name: "Move Left",
            keyCombo: ["ArrowLeft"],
            defaultKeyCombo: ["ArrowLeft"],
            description: "Move viewport to the left",
        },
        {
            id: "move-up",
            name: "Move Up",
            keyCombo: ["ArrowUp"],
            defaultKeyCombo: ["ArrowUp"],
            description: "Move viewport up",
        },
        {
            id: "move-down",
            name: "Move Down",
            keyCombo: ["ArrowDown"],
            defaultKeyCombo: ["ArrowDown"],
            description: "Move viewport down",
        },
        {
            id: "delete-active-label",
            name: "Delete Active Label",
            keyCombo: PlatformUtil.isMac() ? ["Backspace"] : ["Delete"],
            defaultKeyCombo: PlatformUtil.isMac() ? ["Backspace"] : ["Delete"],
            description: "Delete currently selected label",
        },
        {
            id: "toggle-fixed-zoom",
            name: "Toggle Fixed Zoom",
            keyCombo: ["f"],
            defaultKeyCombo: ["f"],
            description:
                "Toggles fixed zoom mode (locks zoom level while navigating)",
        },
        {
            id: "toggle-ellipse-draw",
            name: "Toggle Ellipse Drawing",
            keyCombo: ["l"],
            defaultKeyCombo: ["l"],
            description: "Enables or disables ellipse drawing mode",
        },
        // {
        //     id: 'toggle-moving-annotation',
        //     name: 'Toggle Moving Annotation',
        //     keyCombo: ['m'],
        //     defaultKeyCombo: ['m'],
        //     description: 'Enables or disables annotation move mode'
        // },
        // {
        //     id: 'copy-polygons',
        //     name: 'Copy Polygons',
        //     keyCombo: PlatformUtil.isMac() ? ['Command', 'c'] : ['Control', 'c'],
        //     defaultKeyCombo: PlatformUtil.isMac() ? ['Command', 'c'] : ['Control', 'c'],
        //     description: 'Copies the selected polygons'
        // },
        // {
        //     id: 'paste-polygons',
        //     name: 'Paste Polygons',
        //     keyCombo: PlatformUtil.isMac() ? ['Command', 'v'] : ['Control', 'v'],
        //     defaultKeyCombo: PlatformUtil.isMac() ? ['Command', 'v'] : ['Control', 'v'],
        //     description: 'Pastes copied polygons to current location'
        // },

        // Label selection shortcuts (0-9)
        ...Array.from({ length: 10 }, (_, i) => ({
            id: `select-label-${i}`,
            name: `Select Label ${i}`,
            keyCombo: PlatformUtil.isMac()
                ? ["Alt", i.toString()]
                : ["Control", i.toString()],
            defaultKeyCombo: PlatformUtil.isMac()
                ? ["Alt", i.toString()]
                : ["Control", i.toString()],
            description: `Selects label at index ${i}`,
        })),
    ],
};

export function generalReducer(
    state = initialState,
    action: GeneralActionTypes
): GeneralState {
    switch (action.type) {
        case Action.UPDATE_WINDOW_SIZE: {
            return {
                ...state,
                windowSize: action.payload.windowSize,
            };
        }
        case Action.UPDATE_ACTIVE_POPUP_TYPE: {
            return {
                ...state,
                activePopupType: action.payload.activePopupType,
            };
        }
        case Action.UPDATE_CUSTOM_CURSOR_STYLE: {
            return {
                ...state,
                customCursorStyle: action.payload.customCursorStyle,
            };
        }
        case Action.UPDATE_CONTEXT: {
            return {
                ...state,
                activeContext: action.payload.activeContext,
            };
        }
        case Action.UPDATE_PREVENT_CUSTOM_CURSOR_STATUS: {
            return {
                ...state,
                preventCustomCursor: action.payload.preventCustomCursor,
            };
        }
        case Action.UPDATE_IMAGE_DRAG_MODE_STATUS: {
            return {
                ...state,
                imageDragMode: action.payload.imageDragMode,
            };
        }
        case Action.UPDATE_CROSS_HAIR_VISIBLE_STATUS: {
            return {
                ...state,
                crossHairVisible: action.payload.crossHairVisible,
            };
        }
        case Action.UPDATE_FIXED_ZOOM: {
            return {
                ...state,
                fixedZoom: action.payload.fixedZoom,
            };
        }
        case Action.UPDATE_ELLIPSE_DRAW_STATUS: {
            return {
                ...state,
                ellipseDraw: action.payload.ellipseDraw,
            };
        }
        case Action.UPDATE_MOVING_ANNOTATION_STATUS: {
            return {
                ...state,
                movingAnnotation: action.payload.movingAnnotation,
            };
        }
        case Action.UPDATE_COPY_POLYGONS_STATUS: {
            return {
                ...state,
                copyPolygons: action.payload.copyPolygons,
            };
        }
        case Action.UPDATE_PASTE_POLYGONS_STATUS: {
            return {
                ...state,
                pastePolygons: action.payload.pastePolygons,
            };
        }
        case Action.UPDATE_PROJECT_DATA: {
            return {
                ...state,
                projectData: action.payload.projectData,
            };
        }
        case Action.UPDATE_ZOOM: {
            return {
                ...state,
                zoom: action.payload.zoom,
            };
        }
        case Action.UPDATE_ENABLE_PER_CLASS_COLORATION_STATUS: {
            return {
                ...state,
                enablePerClassColoration:
                    action.payload.enablePerClassColoration,
            };
        }

        case Action.UPDATE_POLYGON_DRAW_MODE: {
            return {
                ...state,
                polygonLassoMode: action.payload.polygonLassoMode,
            };
        }
        case Action.UPDATE_IMAGE_LIST_FILTER_MODE: {
            return {
                ...state,
                imageListFilterMode: action.payload.imageListFilterMode,
            };
        }
        case Action.UPDATE_IMAGE_LIST_SEARCH_TEXT: {
            return {
                ...state,
                imageListSearchText: action.payload.imageListSearchText,
            };
        }
        case Action.UPDATE_IMAGE_CLASS_CRITERIA: {
            return {
                ...state,
                imageClassCriteria: action.payload.imageClassCriteria,
            };
        }

        case Action.UPDATE_KEYBOARD_SHORTCUTS: {
            return {
                ...state,
                keyboardShortcuts: action.payload.keyboardShortcuts,
            };
        }

        case Action.UPDATE_KEYBOARD_SHORTCUT: {
            return {
                ...state,
                keyboardShortcuts: state.keyboardShortcuts.map((shortcut) =>
                    shortcut.id === action.payload.id
                        ? { ...shortcut, keyCombo: action.payload.keyCombo }
                        : shortcut
                ),
            };
        }

        case Action.RESET_KEYBOARD_SHORTCUT: {
            return {
                ...state,
                keyboardShortcuts: state.keyboardShortcuts.map((shortcut) =>
                    shortcut.id === action.payload.id
                        ? { ...shortcut, keyCombo: shortcut.defaultKeyCombo }
                        : shortcut
                ),
            };
        }

        default:
            return state;
    }
}
