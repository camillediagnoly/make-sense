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
import { LineRenderEngine } from "../render/LineRenderEngine";
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
        const actionHandlers: {[key: string]: (event: KeyboardEvent) => void} = {
            'Finish Polygon Creation': (event: KeyboardEvent) => {
                event.preventDefault();
                if (EditorModel.supportRenderingEngine && EditorModel.supportRenderingEngine.labelType === LabelType.POLYGON) {
                    const editorData: EditorData = EditorActions.getEditorData();
                    const isDrawingEllipse: boolean = (EditorModel.supportRenderingEngine as PolygonRenderEngine).isDrawingEllipse;
                    if (!isDrawingEllipse)
                        (EditorModel.supportRenderingEngine as PolygonRenderEngine).addLabelAndFinishCreation(editorData);
                    else
                        (EditorModel.supportRenderingEngine as PolygonRenderEngine).addLabelAndFinishCreationEllipse(editorData);

                }
                EditorActions.fullRender();
            },
            'Cancel Label Creation': (event: KeyboardEvent) => {
                if (EditorModel.supportRenderingEngine) {
                    switch (EditorModel.supportRenderingEngine.labelType) {
                        case LabelType.POLYGON:
                            (EditorModel.supportRenderingEngine as PolygonRenderEngine).cancelLabelCreation();
                            break;
                        case LabelType.LINE:
                            (EditorModel.supportRenderingEngine as LineRenderEngine).cancelLabelCreation();
                            break;
                    }
                }
                EditorActions.fullRender();
            },
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
            'Move Right': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.RIGHT);
            },
            'Move Left': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.LEFT);
            },
            'Move Up': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.BOTTOM);
            },
            'Move Down': (event: KeyboardEvent) => {
                event.preventDefault();
                ViewPortActions.translateViewPortPosition(Direction.TOP);
            },
            'Delete Active Label': (event: KeyboardEvent) => {
                LabelActions.deleteActiveLabel();
            },
            'Toggle Labels Visibility': (event: KeyboardEvent) => {
                const imageData = LabelsSelector.getActiveImageData();
                if (imageData) {
                    LabelActions.toggleAllLabelsVisibilityInImage(imageData.id);
                }
            }
        };

        // Add label selection actions (0-9)
        for (let i = 0; i <= 9; i++) {
            actionHandlers[`Select Label ${i}`] = (event: KeyboardEvent) => {
                ImageActions.setActiveLabelOnActiveImage(i);
                EditorActions.fullRender();
            };
        }

        // Get all shortcuts from Redux
        const shortcuts = store.getState().general.keyboardShortcuts;
        
        // Build actions array by matching shortcuts with handlers
        const actions: HotKeyAction[] = [];
        
        shortcuts.forEach(shortcut => {
            // If we have a handler for this shortcut
            if (actionHandlers[shortcut.name]) {
                actions.push({
                    keyCombo: shortcut.keyCombo,
                    action: actionHandlers[shortcut.name]
                });
            }
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
