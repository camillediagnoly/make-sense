import React, { useCallback, useRef, useState } from 'react';
import './ColorSelectorView.scss'
import { ColorPickerPanel } from './ColorPickerPanel';

interface IProps {
    color: string;
    // Click: random color
    onClick: () => void;
    // Shift+click: opens a panel of predefined colors, the chosen one is passed here
    onColorSelect: (color: string) => void;
}

export const ColorSelectorView: React.FC<IProps> = ({color, onClick, onColorSelect}) => {
    const swatchRef = useRef<HTMLDivElement>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const closePicker = useCallback(() => setIsPickerOpen(false), []);

    const onSwatchClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.shiftKey) {
            setIsPickerOpen(!isPickerOpen);
        } else {
            setIsPickerOpen(false);
            onClick();
        }
    };

    // Shift+mousedown would otherwise extend the text selection of the page
    const onSwatchMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.shiftKey) {
            event.preventDefault();
        }
    };

    const onPickerSelect = (pickedColor: string) => {
        onColorSelect(pickedColor);
        setIsPickerOpen(false);
    };

    return <>
        <div
            ref={swatchRef}
            className={'ColorSelectorView'}
            style={{
                backgroundColor: color
            }}
            title={'Click: random color - Shift+click: pick a color'}
            onMouseDown={onSwatchMouseDown}
            onClick={onSwatchClick}
        >
            <img
                draggable={false}
                alt={'refresh'}
                src={'ico/refresh.png'}
            />
        </div>
        {isPickerOpen && <ColorPickerPanel
            anchor={swatchRef.current}
            selectedColor={color}
            onSelect={onPickerSelect}
            onClose={closePicker}
        />}
    </>
}
