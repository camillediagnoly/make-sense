import { HotKeyAction } from "../../data/HotKeyAction";
import { EditorModel } from "../../staticModels/EditorModel";
import { LabelType } from "../../data/enums/LabelType";
import { EditorData } from "../../data/EditorData";
import { EditorActions } from "../actions/EditorActions";
import { PolygonRenderEngine } from "../render/PolygonRenderEngine";
import { BaseContext } from "./BaseContext";
import { ImageActions } from "../actions/ImageActions";
import { ViewPortActions } from "../actions/ViewPortActions";
import { Direction } from "../../data/enums/Direction";
import { PlatformUtil } from "../../utils/PlatformUtil";
import { LabelActions } from "../actions/LabelActions";
import { LabelsSelector } from "../../store/selectors/LabelsSelector"; 
import { store } from '../../index';
import { ShortcutItem } from '../../store/general/types';
import { ImageHistoryActions } from '../actions/ImageHistoryActions';

export class EditorContext extends BaseContext {
    private static getShortcutByName(name: string): ShortcutItem | undefined {
        return store.getState().general.keyboardShortcuts.find(s => s.name === name);
    }

    // Define empty array that will be populated by initializeActions
    public static actions: HotKeyAction[] = [];

    public static initializeActions() {
        // Create a mapping of action handlers
        // The review mode only moves existing annotations: the shortcuts that create, delete or
        // rename annotations, copy images or toggle tags are left out
        const actionHandlers: {[key: string]: (event: KeyboardEvent) => void} = {
            'Undo Current Image Action': (event: KeyboardEvent) => {
                event.preventDefault();
                if (EditorModel.supportRenderingEngine &&
                    EditorModel.supportRenderingEngine.labelType === LabelType.POLYGON) {
                    const polygonRenderEngine = EditorModel.supportRenderingEngine as PolygonRenderEngine;
                    if (polygonRenderEngine.canUndoLastAddedPoint()) {
                        polygonRenderEngine.undoLastAddedPoint();
                        return;
                    }
                }
                ImageHistoryActions.undoActiveImageAction();
            },
            'Redo Current Image Action': (event: KeyboardEvent) => {
                event.preventDefault();
                ImageHistoryActions.redoActiveImageAction();
            },
            'Previous Image': (event: KeyboardEvent) => {
                ImageActions.getPreviousImage();
            },
            'Next Image': (event: KeyboardEvent) => {
                ImageActions.getNextImage();
            },
            'Zoom In': (event: KeyboardEvent) => {
                ViewPortActions.zoomIn();
            },
            'Zoom Out': (event: KeyboardEvent) => {
                ViewPortActions.zoomOut();
            },
            // The left and right arrows go to the previous / next image (see below), not pan
            'Move Up': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.BOTTOM);
            },
            'Move Down': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.TOP);
            }
        };

        // Handlers that fire the instant a shortcut's key combo stops matching (key released),
        // rather than on every other keyup. Used to stop draining a queued action immediately.
        const releaseHandlers: {[key: string]: (event: KeyboardEvent) => void} = {
            'Previous Image': (event: KeyboardEvent) => {
                ImageActions.cancelPendingNavigation();
            },
            'Next Image': (event: KeyboardEvent) => {
                ImageActions.cancelPendingNavigation();
            },
        };

        // Get all shortcuts from Redux
        const shortcuts = store.getState().general.keyboardShortcuts;

        // Build actions array by matching shortcuts with handlers
        const actions: HotKeyAction[] = [];

        shortcuts.forEach(shortcut => {
            // If we have a handler for this shortcut
            if (actionHandlers[shortcut.name]) {
                actions.push({
                    keyCombo: shortcut.keyCombo,
                    action: actionHandlers[shortcut.name],
                    onRelease: releaseHandlers[shortcut.name]
                });
            }
        });
        
        // Space shows / hides every annotation of the current image (the r / t variants are gone)
        actions.push({
            keyCombo: [" "],
            action: (event: KeyboardEvent) => {
                event.preventDefault();
                if (!event.repeat) {
                    const imageData = LabelsSelector.getActiveImageData();
                    if (imageData) {
                        LabelActions.toggleAllLabelsVisibilityInImage(imageData.id);
                    }
                }
            }
        });

        // The left and right arrows also go to the previous / next image, next to the shortcuts above
        actions.push({
            keyCombo: ["ArrowLeft"],
            action: (event: KeyboardEvent) => {
                event.preventDefault();
                ImageActions.getPreviousImage();
            },
            onRelease: releaseHandlers['Previous Image']
        });
        actions.push({
            keyCombo: ["ArrowRight"],
            action: (event: KeyboardEvent) => {
                event.preventDefault();
                ImageActions.getNextImage();
            },
            onRelease: releaseHandlers['Next Image']
        });

        // Special case for measurement label visibility which isn't in the Redux shortcuts list
        actions.push({
            keyCombo: ["0"],
            action: (event: KeyboardEvent) => {
                LabelActions.toggleMeasurementLabelVisibility();
            }
        });
        
        // Update the static actions array
        EditorContext.actions = actions;
    }
}
