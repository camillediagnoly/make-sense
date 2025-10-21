import React, { useState } from 'react';
import './BackupSettingsPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { updateActivePopupType } from '../../../store/general/actionCreators';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import {
    updateBackupEnabled,
    updateBackupFrequency,
} from '../../../store/backup/actionCreators';
import { BackupTimerService } from '../../../logic/backup/BackupTimerService';
import { BackupManager } from '../../../logic/backup/BackupManager';
import { LabelType } from '../../../data/enums/LabelType';
import { LabelToolkitData } from '../../../data/info/LabelToolkitData';
import { BrowserDetection } from '../../../utils/BrowserDetection';
import { IndexedDBStorage } from '../../../logic/backup/IndexedDBStorage';
import { store } from '../../../index';

interface IProps {
    isEnabled: boolean;
    frequencyMinutes: number;
    status: 'idle' | 'saving' | 'success' | 'error';
    lastBackupTime: Date | null;
    errorMessage: string | null;
    updateActivePopupType: (type: null) => void;
    updateBackupEnabled: (enabled: boolean) => void;
    updateBackupFrequency: (frequency: number) => void;
}

const BackupSettingsPopup: React.FC<IProps> = ({
    isEnabled,
    frequencyMinutes,
    status,
    lastBackupTime,
    errorMessage,
    updateActivePopupType,
    updateBackupEnabled,
    updateBackupFrequency,
}) => {
    // DEBUG: Log browser support
    console.log('=== BACKUP SETTINGS DEBUG ===');
    console.log('Browser supports File System Access API:', BrowserDetection.supportsFileSystemAccess());
    console.log('Browser name:', BrowserDetection.getBrowserName());
    console.log('showDirectoryPicker available:', 'showDirectoryPicker' in window);

    // Initialize from existing BackupManager settings
    const existingDirectoryHandle = BackupManager.getDirectoryHandle();
    const existingExportType = BackupManager.getExportLabelType();

    const [localEnabled, setLocalEnabled] = useState(isEnabled);
    const [localFrequency, setLocalFrequency] = useState(frequencyMinutes);
    const [localLocation, setLocalLocation] = useState(existingDirectoryHandle ? existingDirectoryHandle.name : '~/makesense-backups/');
    const [directoryHandle, setDirectoryHandle] = useState<any>(existingDirectoryHandle);
    const [selectedExportType, setSelectedExportType] = useState<LabelType>(existingExportType || LabelType.POLYGON);

    const onAccept = () => {
        // Apply settings
        updateBackupEnabled(localEnabled);
        updateBackupFrequency(localFrequency);

        // Store directory handle and selected export type in BackupManager
        if (directoryHandle) {
            BackupManager.setDirectoryHandle(directoryHandle);
        }
        BackupManager.setExportLabelType(selectedExportType);

        if (localEnabled) {
            BackupTimerService.restart();
        } else {
            BackupTimerService.stop();
        }

        updateActivePopupType(null);
    };

    const onReject = () => {
        updateActivePopupType(null);
    };

    const handleManualBackup = async () => {
        try {
            await BackupManager.triggerManualBackup();
        } catch (error) {
            console.error('Manual backup failed:', error);
        }
    };

    const formatLastBackupTime = (): string => {
        if (!lastBackupTime) return 'Never';

        const now = new Date();
        const diff = now.getTime() - new Date(lastBackupTime).getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes === 0) return 'Just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;

        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    };

    const handleBrowseClick = async () => {
        try {
            // Check if File System Access API is available
            if (BrowserDetection.supportsFileSystemAccess()) {
                // @ts-ignore - File System Access API types may not be available
                const handle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                });

                // Store the directory handle for later use
                setDirectoryHandle(handle);

                // Display the folder name
                // Note: Browser security prevents access to full absolute paths
                setLocalLocation(handle.name);
                console.log('Selected folder:', handle.name);
            } else {
                // For browsers without File System Access API (Firefox, Safari, etc.)
                const browserName = BrowserDetection.getBrowserName();
                alert(
                    `${browserName} doesn't support folder selection.\n\n` +
                    `Don't worry! Your backups will be automatically saved to your browser's secure storage (IndexedDB).\n\n` +
                    `You can download your backups at any time using the "Download Backups" button below.`
                );
            }
        } catch (error) {
            // User cancelled or error occurred
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error selecting folder:', error);
            }
        }
    };

    const handleDownloadBackups = async () => {
        console.log('=== DOWNLOAD BACKUPS BUTTON CLICKED ===');
        try {
            console.log('Step 1: Fetching files from IndexedDB...');

            // Get all files first to check if there are any
            const files = await IndexedDBStorage.getAllFiles();
            console.log(`Step 2: Found ${files.length} file(s) in IndexedDB`);
            console.log('Files:', files);

            if (files.length === 0) {
                console.log('Step 3: No files found - showing alert');
                alert('No backup files found in browser storage.');
                return;
            }

            console.log('Step 3: Starting download...');
            // Download all files from IndexedDB with their original names
            await IndexedDBStorage.downloadAllFiles();
            console.log('Step 4: Download completed successfully');

            console.log('Step 5: Clearing IndexedDB...');
            // Clear all backup files from IndexedDB after successful download
            await IndexedDBStorage.clearAllFiles();
            console.log('Step 6: IndexedDB cleared - DONE');
        } catch (error) {
            console.error('=== ERROR IN DOWNLOAD PROCESS ===');
            console.error('Error details:', error);
            alert('Failed to download backups. Please try again.');
        }
    };

    const renderContent = () => {
        return (
            <div className="backup-settings-content">
                {/* Backup Mode Fieldset */}
                <fieldset className="backup-fieldset">
                    <legend>Backup Mode</legend>

                    <label className="radio-option">
                        <input
                            type="radio"
                            name="backupMode"
                            checked={localEnabled}
                            onChange={() => setLocalEnabled(true)}
                        />
                        <span className="radio-circle"></span>
                        <span className="radio-text">Automatic Backup</span>
                    </label>

                    <label className="radio-option">
                        <input
                            type="radio"
                            name="backupMode"
                            checked={!localEnabled}
                            onChange={() => setLocalEnabled(false)}
                        />
                        <span className="radio-circle"></span>
                        <span className="radio-text">Manual Backup</span>
                    </label>
                </fieldset>

                {/* Backup Options Fieldset */}
                <fieldset className="backup-fieldset">
                    <legend>Backup Options</legend>

                    <div className="option-group">
                        <div className="option-label">Frequency</div>
                        <select
                            className="option-select"
                            value={localFrequency}
                            onChange={(e) => setLocalFrequency(Number(e.target.value))}
                            disabled={!localEnabled}
                            title="Select how often to automatically save backups"
                        >
                            <option value={0.5}>Every 30 seconds</option>
                            <option value={1}>Every 1 minute</option>
                            <option value={2}>Every 2 minutes</option>
                            <option value={3}>Every 3 minutes</option>
                            <option value={5}>Every 5 minutes</option>
                            <option value={10}>Every 10 minutes</option>
                        </select>
                    </div>

                    <div className="separator"></div>

                    <div className="option-group">
                        <div className="option-label">Backup Location</div>
                        {BrowserDetection.supportsFileSystemAccess() ? (
                            <>
                                <div className="location-input-group">
                                    <input
                                        type="text"
                                        className="location-input"
                                        value={localLocation}
                                        placeholder="No folder selected"
                                        readOnly
                                        title={localLocation}
                                    />
                                    <button
                                        className="browse-button"
                                        onClick={handleBrowseClick}
                                        type="button"
                                    >
                                        Browse
                                    </button>
                                </div>
                                {directoryHandle && (
                                    <div className="location-note location-success">
                                        ✓ Automatic backups will save to this folder
                                    </div>
                                )}
                                {!directoryHandle && (
                                    <div className="location-note">
                                        Note: Only folder name shown (browser security). Backups will save directly to selected folder.
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="location-input-group">
                                    <input
                                        type="text"
                                        className="location-input"
                                        value="Browser Storage (IndexedDB)"
                                        readOnly
                                        title="Backups are stored in your browser's secure storage"
                                    />
                                    <button
                                        className="browse-button"
                                        onClick={handleDownloadBackups}
                                        type="button"
                                        title="Download all backups from browser storage"
                                    >
                                        Download Backups
                                    </button>
                                </div>
                                <div className="location-note location-info">
                                    ℹ {BrowserDetection.getBrowserName()} uses browser storage for backups.
                                    Your data is saved securely and automatically.
                                    Click "Download Backups" to export files to your computer.
                                </div>
                            </>
                        )}
                    </div>
                </fieldset>

                {/* Export Format Selection */}
                <fieldset className="backup-fieldset">
                    <legend>Export Format</legend>

                    <div className="export-format-selection">
                        <div className="option-label">Annotation Type</div>
                        <div className="shape-icons-container">
                            {LabelToolkitData.filter((toolkit) => toolkit.labelType !== LabelType.IMAGE_RECOGNITION).map((toolkit) => (
                                <div
                                    key={toolkit.labelType}
                                    className={`shape-icon-button ${selectedExportType === toolkit.labelType ? 'active' : ''}`}
                                    onClick={() => setSelectedExportType(toolkit.labelType)}
                                    title={toolkit.headerText}
                                >
                                    <img src={toolkit.imageSrc} alt={toolkit.imageAlt} />
                                </div>
                            ))}
                        </div>
                    </div>
                </fieldset>

                {/* Status Display */}
                {(status !== 'idle' || lastBackupTime) && (
                    <div className="status-section">
                        {status === 'error' && (
                            <div className="status-error">
                                ✗ {errorMessage || 'Backup failed'}
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="status-success">
                                ✓ Last backup: {formatLastBackupTime()}
                            </div>
                        )}
                        {status === 'idle' && lastBackupTime && (
                            <div className="status-idle">
                                Last backup: {formatLastBackupTime()}
                            </div>
                        )}
                        {status === 'saving' && (
                            <div className="status-saving">⏳ Saving backup...</div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <GenericYesNoPopup
            title="Backup Settings"
            renderContent={renderContent}
            acceptLabel="Apply"
            onAccept={onAccept}
            rejectLabel="Cancel"
            onReject={onReject}
        />
    );
};

const mapStateToProps = (state: AppState) => ({
    isEnabled: state.backup.isEnabled,
    frequencyMinutes: state.backup.frequencyMinutes,
    status: state.backup.status,
    lastBackupTime: state.backup.lastBackupTime,
    errorMessage: state.backup.errorMessage,
});

const mapDispatchToProps = {
    updateActivePopupType,
    updateBackupEnabled,
    updateBackupFrequency,
};

export default connect(mapStateToProps, mapDispatchToProps)(BackupSettingsPopup);
