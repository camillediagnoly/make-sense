import React, { useState, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { AppState } from '../../../store';
import { ShortcutItem } from '../../../store/general/types';
import { updateKeyboardShortcut } from '../../../store/general/actionCreators';
import { PopupActions } from '../../../logic/actions/PopupActions';
import './EditShortcutsPopup.scss';

interface IProps {
    keyboardShortcuts: ShortcutItem[];
    updateKeyboardShortcut: (id: string, keyCombo: string[]) => any;
}

const EditShortcutsPopup: React.FC<IProps> = ({ 
    keyboardShortcuts, 
    updateKeyboardShortcut 
}) => {
    // Store the original shortcuts to revert to when canceling
    const [originalShortcuts, setOriginalShortcuts] = useState<ShortcutItem[]>([]);
    // Store local changes that will only be applied when Save is clicked
    const [localShortcuts, setLocalShortcuts] = useState<ShortcutItem[]>([]);
    const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
    const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    
    // Initialize state on component mount
    useEffect(() => {
        setOriginalShortcuts([...keyboardShortcuts]);
        setLocalShortcuts([...keyboardShortcuts]);
    }, []);
    
    const handleKeyDown = (event: KeyboardEvent) => {
        if (!isRecording || !activeShortcut) return;
        
        event.preventDefault();
        
        // Create a new array for the key combination
        const newKeys: string[] = [];
        
        // Add modifier keys in a consistent order
        if (event.ctrlKey) newKeys.push('Control');
        if (event.altKey) newKeys.push('Alt');
        if (event.shiftKey) newKeys.push('Shift');
        if (event.metaKey) newKeys.push('Meta'); // Command key on Mac
        
        // Add the main key if it's not a modifier
        const key = event.key;
        if (!['Control', 'Alt', 'Shift', 'Meta', 'Escape'].includes(key) && 
            !newKeys.includes(key)) {
            newKeys.push(key);
        }
        
        // Check for Escape to cancel recording
        if (key === 'Escape') {
            setIsRecording(false);
            setActiveShortcut(null);
            setRecordingKeys([]);
            return;
        }
        
        setRecordingKeys(newKeys);
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
        if (!isRecording || !activeShortcut) return;
        
        // Only complete if there's at least one key and all modifiers are released
        if (recordingKeys.length > 0 && 
            !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
            
            // Don't update if only modifier keys were pressed
            if (recordingKeys.some(k => !['Control', 'Alt', 'Shift', 'Meta'].includes(k))) {
                // Update the local state only, not Redux
                setLocalShortcuts(prev => 
                    prev.map(shortcut => 
                        shortcut.id === activeShortcut 
                            ? { ...shortcut, keyCombo: recordingKeys } 
                            : shortcut
                    )
                );
            }
            
            setIsRecording(false);
            setActiveShortcut(null);
            setRecordingKeys([]);
        }
    };
    
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isRecording, activeShortcut, recordingKeys]);
    
    const startRecording = (id: string) => {
        setActiveShortcut(id);
        setRecordingKeys([]);
        setIsRecording(true);
    };
    
    const resetToDefault = (shortcutId: string) => {
        // Find the original shortcut
        const originalShortcut = originalShortcuts.find(s => s.id === shortcutId);
        if (originalShortcut) {
            // Update local state only
            setLocalShortcuts(prev => 
                prev.map(shortcut => 
                    shortcut.id === shortcutId 
                        ? { ...shortcut, keyCombo: [...originalShortcut.defaultKeyCombo] } 
                        : shortcut
                )
            );
        }
    };
    
    const getKeyComboText = (keys: string[]) => {
        return keys.join(' + ');
    };
    
    const renderContent = () => {
        return (
            <div className="EditShortcutsPopupContent">
                <div className="Message">
                    Edit keyboard shortcuts by clicking on a shortcut and pressing the new key combination.
                </div>
                <div className="ShortcutsList">
                    {localShortcuts.map(shortcut => (
                        <div key={shortcut.id} className="ShortcutItem">
                            <div className="ShortcutName">{shortcut.name}</div>
                            <div 
                                className={`ShortcutKeys ${activeShortcut === shortcut.id ? 'recording' : ''}`}
                                onClick={() => startRecording(shortcut.id)}
                            >
                                {activeShortcut === shortcut.id && isRecording
                                    ? 'Press keys...'
                                    : getKeyComboText(shortcut.keyCombo)}
                            </div>
                            <div 
                                className="ResetButton"
                                onClick={() => resetToDefault(shortcut.id)}
                            >
                                Reset
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };
    
    const onAccept = () => {
        // Apply all changes to Redux
        localShortcuts.forEach(shortcut => {
            const original = originalShortcuts.find(s => s.id === shortcut.id);
            
            // Only update shortcuts that have actually changed
            if (original && JSON.stringify(original.keyCombo) !== JSON.stringify(shortcut.keyCombo)) {
                updateKeyboardShortcut(shortcut.id, shortcut.keyCombo);
            }
        });
        
        PopupActions.close();
    };
    
    const onReject = () => {
        PopupActions.close();
    };
    
    return (
        <GenericYesNoPopup
            title={'Edit Keyboard Shortcuts'}
            renderContent={renderContent}
            acceptLabel={'Save'}
            onAccept={onAccept}
            rejectLabel={'Cancel'}
            onReject={onReject}
        />
    );
};

const mapDispatchToProps = {
    updateKeyboardShortcut
};

const mapStateToProps = (state: AppState) => ({
    keyboardShortcuts: state.general.keyboardShortcuts
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditShortcutsPopup);