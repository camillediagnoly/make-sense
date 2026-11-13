import React, { useCallback, useRef, useState } from 'react';
import './ColorSelectorView.scss'
import { ColorPickerPanel } from './ColorPickerPanel';

interface IProps {
    color: string;
    // Click on the swatch opens a panel of predefined colors, the chosen one is passed here
    onColorSelect: (color: string) => void;
}

export const ColorSelectorView: React.FC<IProps> = ({color, onColorSelect}) => {
    const swatchRef = useRef<HTMLDivElement>(null);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const closePicker = useCallback(() => setIsPickerOpen(false), []);

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
            title={'Pick a color'}
            onClick={() => setIsPickerOpen(!isPickerOpen)}
        />
        {isPickerOpen && <ColorPickerPanel
            anchor={swatchRef.current}
            selectedColor={color}
            onSelect={onPickerSelect}
            onClose={closePicker}
        />}
    </>
}
