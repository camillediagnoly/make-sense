import React from "react";
import {IPoint} from "../interfaces/IPoint";
import {IRect} from "../interfaces/IRect";
import {ISize} from "../interfaces/ISize";

export class CanvasUtil {
    public static getMousePositionOnCanvasFromEvent(
        event: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement> | Event,
        canvas: HTMLCanvasElement
    ): IPoint {
        if (!canvas || !event) {
            return null;
        }

        const clientPosition: IPoint = CanvasUtil.getClientPosition(event);
        if (!clientPosition) {
            return null;
        }

        const canvasRect: DOMRect = canvas.getBoundingClientRect();
        return {
            x: clientPosition.x - canvasRect.left,
            y: clientPosition.y - canvasRect.top
        };
    }

    private static getClientPosition(event: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.TouchEvent<HTMLCanvasElement> | Event): IPoint {
        const normalizedEvent: any = (event as any).nativeEvent || event;

        if (typeof normalizedEvent.clientX === "number" && typeof normalizedEvent.clientY === "number") {
            return {
                x: normalizedEvent.clientX,
                y: normalizedEvent.clientY
            };
        }

        const touch = normalizedEvent.touches?.[0] || normalizedEvent.changedTouches?.[0];
        if (touch && typeof touch.clientX === "number" && typeof touch.clientY === "number") {
            return {
                x: touch.clientX,
                y: touch.clientY
            };
        }

        return null;
    }

    public static getClientRect(canvas: HTMLCanvasElement): IRect {
        if (canvas) {
            const canvasRect: DOMRect = canvas.getBoundingClientRect();
            return {
                x: canvasRect.left,
                y: canvasRect.top,
                width: canvasRect.width,
                height: canvasRect.height
            }
        }
        return null;
    }

    public static getSize(canvas: HTMLCanvasElement): ISize {
        if (canvas) {
            const canvasRect: DOMRect = canvas.getBoundingClientRect();
            return {
                width: canvasRect.width,
                height: canvasRect.height
            }
        }
        return null;
    }
}
