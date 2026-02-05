import { AppState } from '../index';
import { BackupState } from './types';

export class BackupSelector {
    public static getBackupState(state: AppState): BackupState {
        return state.backup;
    }

    public static isBackupEnabled(state: AppState): boolean {
        return state.backup.isEnabled;
    }

    public static getBackupStatus(state: AppState): 'idle' | 'saving' | 'success' | 'error' {
        return state.backup.status;
    }

    public static getBackupFrequency(state: AppState): number {
        return state.backup.frequencyMinutes;
    }

    public static getBackupLocation(state: AppState): 'default' | 'custom' {
        return state.backup.storageLocation;
    }

    public static getCustomFolderPath(state: AppState): string | null {
        return state.backup.customFolderPath;
    }

    public static getLastBackupTime(state: AppState): Date | null {
        return state.backup.lastBackupTime;
    }

    public static getErrorMessage(state: AppState): string | null {
        return state.backup.errorMessage;
    }

    public static isErrorDismissed(state: AppState): boolean {
        return state.backup.errorDismissed;
    }

    public static getBackupFilePath(state: AppState): string | null {
        return state.backup.backupFilePath;
    }

    public static getProjectName(state: AppState): string {
        return state.backup.projectName;
    }

    public static shouldShowErrorIndicator(state: AppState): boolean {
        return state.backup.status === 'error' && !state.backup.errorDismissed;
    }
}
