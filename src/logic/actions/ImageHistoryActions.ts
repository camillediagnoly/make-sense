import { store } from '../../index';
import {
    redoActiveImageAction as redoActiveImageActionCreator,
    undoActiveImageAction as undoActiveImageActionCreator,
} from '../../store/labels/actionCreators';
import { EditorActions } from './EditorActions';

export class ImageHistoryActions {
    public static undoActiveImageAction(): void {
        store.dispatch(undoActiveImageActionCreator());
        EditorActions.fullRender();
    }

    public static redoActiveImageAction(): void {
        store.dispatch(redoActiveImageActionCreator());
        EditorActions.fullRender();
    }
}
