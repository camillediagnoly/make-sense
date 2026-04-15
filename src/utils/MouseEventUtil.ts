import {EventType} from "../data/enums/EventType";
 
export class MouseEventUtil {
    public static getEventType(event: Event): EventType | null {
        if (!event) return null;
 
        switch (event.type) {
            case EventType.MOUSE_DOWN:
                return EventType.MOUSE_DOWN;
            case EventType.MOUSE_UP:
                return EventType.MOUSE_UP;
            case EventType.MOUSE_MOVE:
                return EventType.MOUSE_MOVE;
            case EventType.POINTER_DOWN:
                return EventType.POINTER_DOWN;
            case EventType.POINTER_MOVE:
                return EventType.POINTER_MOVE;
            case EventType.POINTER_UP:
                return EventType.POINTER_UP;
            case EventType.TOUCH_START:
                return EventType.TOUCH_START;
            case EventType.TOUCH_MOVE:
                return EventType.TOUCH_MOVE;
            case EventType.TOUCH_END:
                return EventType.TOUCH_END;
            default:
                return null;
        }
    }
}
