import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from '../../../../settings/Settings';
import { EventType } from '../../../../data/enums/EventType';
import './ColorPickerPanel.scss';

interface IProps {
    anchor: HTMLElement;
    selectedColor: string;
    onSelect: (color: string) => void;
    onClose: () => void;
}

const MARGIN_PX = 6;

// Grid of predefined colors, one column per hue from light to dark. It is rendered in
// document.body so the scroll area of the popup holding the swatch does not clip it.
export const ColorPickerPanel: React.FC<IProps> = ({ anchor, selectedColor, onSelect, onClose }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ left: number, top: number } | null>(null);

    // Below the swatch, or above it when there is no room left, and kept inside the window
    useLayoutEffect(() => {
        const anchorRect: DOMRect = anchor.getBoundingClientRect();
        const panelRect: DOMRect = panelRef.current.getBoundingClientRect();
        const maxLeft: number = window.innerWidth - panelRect.width - MARGIN_PX;
        const left: number = Math.max(MARGIN_PX, Math.min(anchorRect.left, maxLeft));
        const fitsBelow: boolean = anchorRect.bottom + MARGIN_PX + panelRect.height <= window.innerHeight;
        const top: number = fitsBelow
            ? anchorRect.bottom + MARGIN_PX
            : Math.max(MARGIN_PX, anchorRect.top - MARGIN_PX - panelRect.height);
        setPosition({ left, top });
    }, [anchor]);

    useEffect(() => {
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!panelRef.current.contains(target) && !anchor.contains(target)) {
                onClose();
            }
        };
        // Escape closes the panel only, not the popup underneath (the shortcuts listen on window
        // in the bubbling phase, this listener runs before them).
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
            }
        };
        // The panel does not follow the swatch, so it goes away as soon as anything moves.
        const onScrollOrResize = (event: Event) => {
            if (!(event.target instanceof Node) || !panelRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener(EventType.MOUSE_DOWN, onMouseDown);
        window.addEventListener(EventType.KEY_DOWN, onKeyDown, true);
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener(EventType.RESIZE, onScrollOrResize);
        return () => {
            document.removeEventListener(EventType.MOUSE_DOWN, onMouseDown);
            window.removeEventListener(EventType.KEY_DOWN, onKeyDown, true);
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener(EventType.RESIZE, onScrollOrResize);
        };
    }, [anchor, onClose]);

    const normalizedSelectedColor: string = selectedColor?.toLowerCase();

    return createPortal(
        <div
            className='ColorPickerPanel'
            ref={panelRef}
            style={position
                ? { left: position.left, top: position.top }
                : { left: 0, top: 0, visibility: 'hidden' }}
        >
            {Settings.COLOR_PICKER_PALETTE.map((shades: string[], hueIndex: number) =>
                <div className='ColorPickerColumn' key={hueIndex}>
                    {shades.map((color: string) =>
                        <div
                            key={color}
                            className={color === normalizedSelectedColor
                                ? 'ColorPickerSwatch selected'
                                : 'ColorPickerSwatch'}
                            style={{ backgroundColor: color }}
                            title={color}
                            onClick={() => onSelect(color)}
                        />
                    )}
                </div>
            )}
        </div>,
        document.body
    );
};
