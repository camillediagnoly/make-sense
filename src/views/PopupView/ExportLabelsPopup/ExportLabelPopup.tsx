import React, { useState } from 'react';
import './ExportLabelPopup.scss';
import { AnnotationFormatType } from '../../../data/enums/AnnotationFormatType';
import { RectLabelsExporter } from '../../../logic/export/RectLabelsExporter';
import { LabelType } from '../../../data/enums/LabelType';
import { ILabelFormatData } from '../../../interfaces/ILabelFormatData';
import { PointLabelsExporter } from '../../../logic/export/PointLabelsExport';
import { PolygonLabelsExporter } from '../../../logic/export/polygon/PolygonLabelsExporter';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { LineLabelsExporter } from '../../../logic/export/LineLabelExport';
import { TagLabelsExporter } from '../../../logic/export/TagLabelsExport';
import GenericLabelTypePopup from '../GenericLabelTypePopup/GenericLabelTypePopup';
import { ExportFormatData } from '../../../data/ExportFormatData';
import { LabelToolkitData } from '../../../data/info/LabelToolkitData';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { BackupManager } from '../../../logic/backup/BackupManager';
import { BackupTimerService } from '../../../logic/backup/BackupTimerService';
import { BrowserDetection } from '../../../utils/BrowserDetection';
import { IndexedDBStorage } from '../../../logic/backup/IndexedDBStorage';
import {
    updateBackupEnabled,
    updateBackupFrequency,
} from '../../../store/backup/actionCreators';

interface IProps {
    activeLabelType: LabelType;
    isEnabled: boolean;
    frequencyMinutes: number;
    status: 'idle' | 'saving' | 'success' | 'error';
    lastBackupTime: Date | null;
    errorMessage: string | null;
    projectName: string;
    updateBackupEnabled: (enabled: boolean) => void;
    updateBackupFrequency: (frequency: number) => void;
}

const ExportLabelPopup: React.FC<IProps> = ({
    activeLabelType,
    isEnabled,
    frequencyMinutes,
    status,
    lastBackupTime,
    errorMessage,
    projectName,
    updateBackupEnabled,
    updateBackupFrequency,
}) => {
    // Helper function to get the last format for a given label type
    const getLastFormat = (type: LabelType): AnnotationFormatType => {
        const formats = ExportFormatData[type];
        return formats[formats.length - 1].type;
    };

    // Initialize states from BackupManager to preserve user settings
    const existingDirectoryHandle = BackupManager.getDirectoryHandle();
    const existingExportType = BackupManager.getExportLabelType();

    const [labelType, setLabelType] = useState(LabelType.POLYGON);
    const [exportFormatType, setExportFormatType] = useState(getLastFormat(LabelType.POLYGON));
    const [showBackupSettings, setShowBackupSettings] = useState(false);
    const [localEnabled, setLocalEnabled] = useState(isEnabled);
    const [localFrequency, setLocalFrequency] = useState(frequencyMinutes);
    const [localLocation, setLocalLocation] = useState(existingDirectoryHandle ? existingDirectoryHandle.name : '~/makesense-backups/');
    const [selectedExportType, setSelectedExportType] = useState(existingExportType);
    const [directoryHandle, setDirectoryHandle] = useState<any>(existingDirectoryHandle);

    const onAccept = (type: LabelType) => {
        if (showBackupSettings) {
            // Apply backup settings
            updateBackupEnabled(localEnabled);
            updateBackupFrequency(localFrequency);

            // Store directory handle and export type in BackupManager
            // For Firefox (IndexedDB), always use POLYGON (JSON format)
            // For Chrome/Edge (File System API), use selected format
            if (directoryHandle) {
                BackupManager.setDirectoryHandle(directoryHandle);
            }
            const exportType = BrowserDetection.supportsFileSystemAccess()
                ? selectedExportType
                : LabelType.POLYGON;
            BackupManager.setExportLabelType(exportType);

            if (localEnabled) {
                BackupTimerService.restart();
            } else {
                BackupTimerService.stop();
            }

            PopupActions.close();
        } else {
            // Export labels
            switch (type) {
                case LabelType.RECT:
                    RectLabelsExporter.export(exportFormatType);
                    break;
                case LabelType.POINT:
                    PointLabelsExporter.export(exportFormatType);
                    break;
                case LabelType.LINE:
                    LineLabelsExporter.export(exportFormatType);
                    break;
                case LabelType.POLYGON:
                    PolygonLabelsExporter.export(exportFormatType);
                    break;
                case LabelType.IMAGE_RECOGNITION:
                    TagLabelsExporter.export(exportFormatType);
                    break;
            }
            PopupActions.close();
        }
    };

    const onReject = (type: LabelType) => {
        PopupActions.close();
    };

    const onSelect = (type: AnnotationFormatType) => {
        setExportFormatType(type);
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
                    `You can download your backups at any time using the "Download Backups" button.`
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
        try {
            await IndexedDBStorage.downloadAllProjectFiles(projectName || 'untitled-project');
            alert('All backup files have been downloaded successfully!');
        } catch (error) {
            console.error('Error downloading backups:', error);
            alert('Failed to download backups. Please try again.');
        }
    };

    const getOptions = (exportFormatData: ILabelFormatData[]) => {
        return exportFormatData.map((entry: ILabelFormatData) => {
            return <div
                className='OptionsItem'
                onClick={() => onSelect(entry.type)}
                key={entry.type}
            >
                {entry.type === exportFormatType ?
                    <img
                        draggable={false}
                        src={'ico/checkbox-checked.png'}
                        alt={'checked'}
                    /> :
                    <img
                        draggable={false}
                        src={'ico/checkbox-unchecked.png'}
                        alt={'unchecked'}
                    />}
                {entry.label}
            </div>;
        });
    };

    const renderBackupSettings = () => {
        return (
            <div className="backup-settings-content">
                {/* Backup Mode Fieldset */}
                <fieldset className="backup-fieldset">
                    <legend>Backup Mode</legend>

                    <div className="radio-options-container">
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
                    </div>
                </fieldset>

                {/* Backup Options Fieldset - Always visible but disabled when Manual Backup is selected */}
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
                            <option value={1}>Every 1 minute</option>
                            <option value={2}>Every 2 minutes</option>
                            <option value={3}>Every 3 minutes</option>
                            <option value={5}>Every 5 minutes</option>
                            <option value={10}>Every 10 minutes</option>
                        </select>
                    </div>

                    <div className="separator"></div>

                    {BrowserDetection.supportsFileSystemAccess() ? (
                        <div className="option-group">
                            <div className="option-label">Location</div>
                            <div className="location-input-group">
                                <input
                                    type="text"
                                    className="location-input"
                                    value={localLocation}
                                    placeholder="No folder selected"
                                    readOnly
                                    disabled={!localEnabled}
                                    title={localLocation}
                                />
                                <button
                                    className="browse-button"
                                    onClick={handleBrowseClick}
                                    disabled={!localEnabled}
                                    type="button"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="option-group">
                                <div className="option-label">Location</div>
                                <button
                                    className="download-backups-button"
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

                    {/* Export Format Selection - Only show for browsers with File System Access API */}
                    {BrowserDetection.supportsFileSystemAccess() && (
                        <>
                            <div className="separator"></div>
                            <div className="export-format-selection">
                                <div className="selection-label">Format</div>
                                <div className="shape-icons-container">
                                    {LabelToolkitData.filter((toolkit) => toolkit.labelType !== LabelType.IMAGE_RECOGNITION).map((toolkit) => (
                                        <div
                                            key={toolkit.labelType}
                                            className={`shape-icon-button ${selectedExportType === toolkit.labelType ? 'active' : ''} ${!localEnabled ? 'disabled' : ''}`}
                                            onClick={() => localEnabled && setSelectedExportType(toolkit.labelType)}
                                            title={toolkit.headerText}
                                        >
                                            <img src={toolkit.imageSrc} alt={toolkit.imageAlt} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
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

    const renderInternalContent = (type: LabelType) => {
        if (showBackupSettings) {
            return renderBackupSettings();
        }

        return <>
            <div className='Message'>
                Select label type and the file format you would like to use to export labels.
            </div>,
            <div className='Options'>
                {getOptions(ExportFormatData[type])}
            </div>
        </>;
    };

    const onLabelTypeChange = (type: LabelType) => {
        setLabelType(type);
        setExportFormatType(getLastFormat(type));
        setShowBackupSettings(false); // Reset backup settings view
    };

    const onSettingsIconClick = () => {
        setShowBackupSettings(!showBackupSettings);
    };

    return (
        <GenericLabelTypePopup
            activeLabelType={labelType}
            title={showBackupSettings ? 'Backup Settings' : `Export ${labelType.toLowerCase()} annotations`}
            onLabelTypeChange={onLabelTypeChange}
            acceptLabel={showBackupSettings ? 'Apply' : 'Export'}
            onAccept={onAccept}
            disableAcceptButton={showBackupSettings ? (BrowserDetection.supportsFileSystemAccess() && !directoryHandle) : !exportFormatType}
            disabledTooltip={showBackupSettings && BrowserDetection.supportsFileSystemAccess() && !directoryHandle ? 'Please select a backup location first' : undefined}
            rejectLabel={'Cancel'}
            onReject={onReject}
            renderInternalContent={renderInternalContent}
            showSettingsIcon={true}
            onSettingsIconClick={onSettingsIconClick}
            settingsIconActive={showBackupSettings}
        />
    );
};

const mapDispatchToProps = {
    updateBackupEnabled,
    updateBackupFrequency,
};

const mapStateToProps = (state: AppState) => ({
    activeLabelType: state.labels.activeLabelType,
    isEnabled: state.backup.isEnabled,
    frequencyMinutes: state.backup.frequencyMinutes,
    status: state.backup.status,
    lastBackupTime: state.backup.lastBackupTime,
    errorMessage: state.backup.errorMessage,
    projectName: state.general.projectData.name,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ExportLabelPopup);