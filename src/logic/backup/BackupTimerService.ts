import { store } from '../../index';
import { BackupManager } from './BackupManager';
import { updateBackupProjectName } from '../../store/backup/actionCreators';

export class BackupTimerService {
    private static intervalId: NodeJS.Timeout | null = null;
    private static isRunning: boolean = false;

    /**
     * Start the automatic backup timer
     */
    public static start(): void {
        const backupState = store.getState().backup;

        if (!backupState.isEnabled) {
            console.log('Backup is disabled, timer not started');
            return;
        }

        if (this.isRunning) {
            console.log('Backup timer already running, restarting...');
            this.stop();
        }

        // Update project name in backup state
        const projectName = store.getState().general.projectData.name;
        if (projectName) {
            store.dispatch(updateBackupProjectName(projectName));
        }

        // Set up interval
        const frequencyMs = backupState.frequencyMinutes * 60 * 1000;

        this.intervalId = setInterval(() => {
            this.performScheduledBackup();
        }, frequencyMs);

        this.isRunning = true;

        console.log(`Backup timer started: ${backupState.frequencyMinutes} minute interval`);
    }

    /**
     * Stop the automatic backup timer
     */
    public static stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('Backup timer stopped');
        }
    }

    /**
     * Restart the timer (useful when settings change)
     */
    public static restart(): void {
        this.stop();
        this.start();
    }

    /**
     * Check if timer is running
     */
    public static isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Perform scheduled backup
     */
    private static async performScheduledBackup(): Promise<void> {
        const backupState = store.getState().backup;
        const labelsState = store.getState().labels;

        // Check if backup is still enabled
        if (!backupState.isEnabled) {
            console.log('Backup disabled, stopping timer');
            this.stop();
            return;
        }

        // Skip if no images loaded
        if (labelsState.imagesData.length === 0) {
            console.log('No images loaded, skipping backup');
            return;
        }

        // Skip if already saving
        if (backupState.status === 'saving') {
            console.log('Backup already in progress, skipping');
            return;
        }

        console.log('Performing scheduled annotation export...');

        try {
            // Perform automatic export based on user-selected label type
            await BackupManager.performAutomaticExport();
        } catch (error) {
            console.error('Scheduled annotation export failed:', error);
            // Error already handled in BackupManager
        }
    }
}
