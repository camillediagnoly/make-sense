import { Action } from '../Actions';
import { BackupActionTypes } from './types';

export function updateBackupEnabled(isEnabled: boolean): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_ENABLED,
        payload: {
            isEnabled,
        },
    };
}

export function updateBackupFrequency(frequencyMinutes: number): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_FREQUENCY,
        payload: {
            frequencyMinutes,
        },
    };
}

export function updateBackupLocation(
    storageLocation: 'default' | 'custom',
    customFolderPath: string | null
): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_LOCATION,
        payload: {
            storageLocation,
            customFolderPath,
        },
    };
}

export function updateBackupStatus(
    status: 'idle' | 'saving' | 'success' | 'error'
): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_STATUS,
        payload: {
            status,
        },
    };
}

export function updateLastBackupTime(lastBackupTime: Date): BackupActionTypes {
    return {
        type: Action.UPDATE_LAST_BACKUP_TIME,
        payload: {
            lastBackupTime,
        },
    };
}

export function updateBackupError(errorMessage: string): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_ERROR,
        payload: {
            errorMessage,
        },
    };
}

export function dismissBackupError(): BackupActionTypes {
    return {
        type: Action.DISMISS_BACKUP_ERROR,
    };
}

export function updateBackupFilePath(backupFilePath: string): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_FILE_PATH,
        payload: {
            backupFilePath,
        },
    };
}

export function updateBackupProjectName(projectName: string): BackupActionTypes {
    return {
        type: Action.UPDATE_BACKUP_PROJECT_NAME,
        payload: {
            projectName,
        },
    };
}
