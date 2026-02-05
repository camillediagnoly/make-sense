import { Action } from '../Actions';

export type BackupState = {
    // Settings
    isEnabled: boolean;
    frequencyMinutes: number;
    storageLocation: 'default' | 'custom';
    customFolderPath: string | null;

    // Status
    status: 'idle' | 'saving' | 'success' | 'error';
    lastBackupTime: Date | null;
    errorMessage: string | null;
    errorDismissed: boolean;

    // Metadata
    projectName: string;
    backupFilePath: string | null;
}

export type BackupFile = {
    metadata: {
        projectName: string;
        projectType: string;
        backupTimestamp: string;
        makesenseVersion: string;
        imageCount: number;
        annotationCount: number;
    };
    labels: any; // Will be typed from LabelsState
    general: any; // Partial general state
    checksum: string;
}

interface UpdateBackupEnabled {
    type: typeof Action.UPDATE_BACKUP_ENABLED;
    payload: {
        isEnabled: boolean;
    };
}

interface UpdateBackupFrequency {
    type: typeof Action.UPDATE_BACKUP_FREQUENCY;
    payload: {
        frequencyMinutes: number;
    };
}

interface UpdateBackupLocation {
    type: typeof Action.UPDATE_BACKUP_LOCATION;
    payload: {
        storageLocation: 'default' | 'custom';
        customFolderPath: string | null;
    };
}

interface UpdateBackupStatus {
    type: typeof Action.UPDATE_BACKUP_STATUS;
    payload: {
        status: 'idle' | 'saving' | 'success' | 'error';
    };
}

interface UpdateLastBackupTime {
    type: typeof Action.UPDATE_LAST_BACKUP_TIME;
    payload: {
        lastBackupTime: Date;
    };
}

interface UpdateBackupError {
    type: typeof Action.UPDATE_BACKUP_ERROR;
    payload: {
        errorMessage: string;
    };
}

interface DismissBackupError {
    type: typeof Action.DISMISS_BACKUP_ERROR;
}

interface UpdateBackupFilePath {
    type: typeof Action.UPDATE_BACKUP_FILE_PATH;
    payload: {
        backupFilePath: string;
    };
}

interface UpdateBackupProjectName {
    type: typeof Action.UPDATE_BACKUP_PROJECT_NAME;
    payload: {
        projectName: string;
    };
}

export type BackupActionTypes =
    | UpdateBackupEnabled
    | UpdateBackupFrequency
    | UpdateBackupLocation
    | UpdateBackupStatus
    | UpdateLastBackupTime
    | UpdateBackupError
    | DismissBackupError
    | UpdateBackupFilePath
    | UpdateBackupProjectName;
