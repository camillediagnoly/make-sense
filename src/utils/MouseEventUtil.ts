import {EventType} from "../data/enums/EventType";

export class MouseEventUtil {
    public static getEventType(event: Event): EventType | null {
        if (!event) return null;

        switch (event.type) {
            case EventType.MOUSE_DOWN:
            case EventType.POINTER_DOWN:
            case EventType.TOUCH_START:
                return EventType.MOUSE_DOWN;
            case EventType.MOUSE_UP:
            case EventType.POINTER_UP:
            case EventType.POINTER_CANCEL:
            case EventType.TOUCH_END:
            case EventType.TOUCH_CANCEL:
                return EventType.MOUSE_UP;
            case EventType.MOUSE_MOVE:
            case EventType.POINTER_MOVE:
            case EventType.TOUCH_MOVE:
                return EventType.MOUSE_MOVE;
            default:
                return null;
        }
    }
}
