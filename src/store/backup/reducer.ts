import { BackupState, BackupActionTypes } from './types';
import { Action } from '../Actions';

const initialState: BackupState = {
    // Settings
    isEnabled: false,
    frequencyMinutes: 0.5, // Default: 30 seconds
    storageLocation: 'default',
    customFolderPath: null,

    // Status
    status: 'idle',
    lastBackupTime: null,
    errorMessage: null,
    errorDismissed: true,

    // Metadata
    projectName: '',
    backupFilePath: null,
};

export function backupReducer(
    state = initialState,
    action: BackupActionTypes
): BackupState {
    switch (action.type) {
        case Action.UPDATE_BACKUP_ENABLED: {
            return {
                ...state,
                isEnabled: action.payload.isEnabled,
                // Reset error when disabling
                ...(action.payload.isEnabled === false && {
                    status: 'idle',
                    errorMessage: null,
                    errorDismissed: true,
                }),
            };
        }
        case Action.UPDATE_BACKUP_FREQUENCY: {
            return {
                ...state,
                frequencyMinutes: action.payload.frequencyMinutes,
            };
        }
        case Action.UPDATE_BACKUP_LOCATION: {
            return {
                ...state,
                storageLocation: action.payload.storageLocation,
                customFolderPath: action.payload.customFolderPath,
            };
        }
        case Action.UPDATE_BACKUP_STATUS: {
            return {
                ...state,
                status: action.payload.status,
                // Clear error when status changes from error
                ...(state.status === 'error' && action.payload.status !== 'error' && {
                    errorMessage: null,
                    errorDismissed: true,
                }),
            };
        }
        case Action.UPDATE_LAST_BACKUP_TIME: {
            return {
                ...state,
                lastBackupTime: action.payload.lastBackupTime,
            };
        }
        case Action.UPDATE_BACKUP_ERROR: {
            return {
                ...state,
                status: 'error',
                errorMessage: action.payload.errorMessage,
                errorDismissed: false,
            };
        }
        case Action.DISMISS_BACKUP_ERROR: {
            return {
                ...state,
                errorDismissed: true,
                // Keep error message for reference but hide indicator
            };
        }
        case Action.UPDATE_BACKUP_FILE_PATH: {
            return {
                ...state,
                backupFilePath: action.payload.backupFilePath,
            };
        }
        case Action.UPDATE_BACKUP_PROJECT_NAME: {
            return {
                ...state,
                projectName: action.payload.projectName,
            };
        }
        default:
            return state;
    }
}
