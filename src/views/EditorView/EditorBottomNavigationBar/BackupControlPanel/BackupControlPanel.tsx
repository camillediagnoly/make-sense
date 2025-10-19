import React, { useState } from 'react';
import { connect } from 'react-redux';
import { AppState } from '../../../../store';
import {
    updateBackupEnabled,
    updateBackupFrequency,
    updateBackupLocation,
} from '../../../../store/backup/actionCreators';
import { BackupManager } from '../../../../logic/backup/BackupManager';
import { BackupTimerService } from '../../../../logic/backup/BackupTimerService';
import './BackupControlPanel.scss';

interface IProps {
    isEnabled: boolean;
    frequencyMinutes: number;
    storageLocation: 'default' | 'custom';
    customFolderPath: string | null;
    status: 'idle' | 'saving' | 'success' | 'error';
    lastBackupTime: Date | null;
    errorMessage: string | null;
    projectName: string;
    onClose: () => void;
    updateBackupEnabled: (enabled: boolean) => void;
    updateBackupFrequency: (frequency: number) => void;
    updateBackupLocation: (location: 'default' | 'custom', path: string | null) => void;
}

const BackupControlPanel: React.FC<IProps> = ({
    isEnabled,
    frequencyMinutes,
    storageLocation,
    customFolderPath,
    status,
    lastBackupTime,
    errorMessage,
    projectName,
    onClose,
    updateBackupEnabled,
    updateBackupFrequency,
    updateBackupLocation,
}) => {
    const [localFrequency, setLocalFrequency] = useState(frequencyMinutes);

    /**
     * Handle enable/disable backup
     */
    const handleToggleEnabled = (enabled: boolean) => {
        updateBackupEnabled(enabled);

        if (enabled) {
            BackupTimerService.start();
        } else {
            BackupTimerService.stop();
        }
    };

    /**
     * Handle frequency change
     */
    const handleFrequencyChange = (frequency: number) => {
        setLocalFrequency(frequency);
        updateBackupFrequency(frequency);

        // Restart timer with new frequency if enabled
        if (isEnabled) {
            BackupTimerService.restart();
        }
    };

    /**
     * Handle storage location change
     */
    const handleLocationChange = (location: 'default' | 'custom') => {
        if (location === 'custom') {
            // Trigger folder picker
            handleChooseFolder();
        } else {
            updateBackupLocation('default', null);
        }
    };

    /**
     * Open folder picker for custom location
     */
    const handleChooseFolder = async () => {
        try {
            // @ts-ignore - File System Access API
            if ('showDirectoryPicker' in window) {
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker();
                const folderPath = dirHandle.name; // This is limited in browser
                updateBackupLocation('custom', folderPath);
            } else {
                alert('Folder selection not supported in this browser. Please use a modern browser like Chrome, Edge, or Safari.');
            }
        } catch (error) {
            console.error('Folder selection cancelled or failed:', error);
        }
    };

    /**
     * Trigger manual backup
     */
    const handleManualBackup = async () => {
        try {
            await BackupManager.triggerManualBackup();
        } catch (error) {
            console.error('Manual backup failed:', error);
        }
    };

    /**
     * Format last backup time
     */
    const formatLastBackupTime = (): string => {
        if (!lastBackupTime) return 'Never';

        const now = new Date();
        const diff = now.getTime() - new Date(lastBackupTime).getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes === 0) return 'Just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;

        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    };

    /**
     * Get display path for backup location
     */
    const getDisplayPath = (): string => {
        const safeProjectName = (projectName || 'untitled-project').replace(/[^a-z0-9_-]/gi, '_');

        if (storageLocation === 'custom' && customFolderPath) {
            return `${customFolderPath}/${safeProjectName}.json`;
        }

        // Show platform-specific default path
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) {
            return `C:\\Users\\YourName\\makesense-backups\\${safeProjectName}.json`;
        } else if (platform.includes('mac')) {
            return `~/makesense-backups/${safeProjectName}.json`;
        } else {
            return `~/makesense-backups/${safeProjectName}.json`;
        }
    };

    return (
        <div className="backup-control-panel">
            <div className="panel-header">
                <span className="panel-title">💾 Backup Settings</span>
                <button className="close-button" onClick={onClose}>
                    ×
                </button>
            </div>

            <div className="panel-content">
                {/* Enable Backup */}
                <div className="setting-row">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => handleToggleEnabled(e.target.checked)}
                        />
                        <span>Enable Automatic Backup</span>
                    </label>

                    {isEnabled && (
                        <div className="frequency-selector">
                            <span>Every</span>
                            <select
                                value={localFrequency}
                                onChange={(e) => handleFrequencyChange(Number(e.target.value))}
                                disabled={!isEnabled}
                            >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                            </select>
                            <span>minutes</span>
                        </div>
                    )}
                </div>

                {/* Save Location */}
                {isEnabled && (
                    <>
                        <div className="setting-section">
                            <h4>Save Location:</h4>

                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="location"
                                    checked={storageLocation === 'default'}
                                    onChange={() => handleLocationChange('default')}
                                />
                                <span>Default Location</span>
                            </label>
                            <div className="location-path">{getDisplayPath()}</div>

                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="location"
                                    checked={storageLocation === 'custom'}
                                    onChange={() => handleLocationChange('custom')}
                                />
                                <span>Custom Folder</span>
                            </label>

                            {storageLocation === 'custom' && (
                                <button className="folder-button" onClick={handleChooseFolder}>
                                    📁 {customFolderPath ? 'Change Folder' : 'Choose Folder...'}
                                </button>
                            )}
                        </div>

                        {/* Warning */}
                        <div className="warning-box">
                            ⚠️ Backup file will be overwritten each time
                        </div>

                        {/* Status */}
                        <div className="status-section">
                            <h4>Current Status:</h4>
                            <div className="status-info">
                                {status === 'idle' && isEnabled && (
                                    <span className="status-text active">● Backup is active</span>
                                )}
                                {status === 'saving' && (
                                    <span className="status-text saving">⏳ Saving backup...</span>
                                )}
                                {status === 'success' && (
                                    <span className="status-text success">✓ Backup successful</span>
                                )}
                                {status === 'error' && (
                                    <span className="status-text error">✗ Backup failed: {errorMessage}</span>
                                )}
                                <div className="last-backup">Last saved: {formatLastBackupTime()}</div>
                            </div>
                        </div>

                        {/* Manual Backup */}
                        <button
                            className="manual-backup-button"
                            onClick={handleManualBackup}
                            disabled={status === 'saving'}
                        >
                            {status === 'saving' ? 'Saving...' : 'Manual Backup Now'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    isEnabled: state.backup.isEnabled,
    frequencyMinutes: state.backup.frequencyMinutes,
    storageLocation: state.backup.storageLocation,
    customFolderPath: state.backup.customFolderPath,
    status: state.backup.status,
    lastBackupTime: state.backup.lastBackupTime,
    errorMessage: state.backup.errorMessage,
    projectName: state.backup.projectName || state.general.projectData.name,
});

const mapDispatchToProps = {
    updateBackupEnabled,
    updateBackupFrequency,
    updateBackupLocation,
};

export default connect(mapStateToProps, mapDispatchToProps)(BackupControlPanel);
