import { store } from '../../index';
import { LabelsState } from '../../store/labels/types';
import { GeneralState } from '../../store/general/types';
import {
    updateBackupStatus,
    updateLastBackupTime,
    updateBackupError,
    updateBackupFilePath,
} from '../../store/backup/actionCreators';
import { BackupFile } from '../../store/backup/types';
import { ProjectType } from '../../data/enums/ProjectType';
import { LabelType } from '../../data/enums/LabelType';
import { AnnotationFormatType } from '../../data/enums/AnnotationFormatType';
import { ExportFormatData } from '../../data/ExportFormatData';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { RectLabelsExporter } from '../export/RectLabelsExporter';
import { PointLabelsExporter } from '../export/PointLabelsExport';
import { LineLabelsExporter } from '../export/LineLabelExport';
import { COCOExporter } from '../export/polygon/COCOExporter';
import { VGGExporter } from '../export/polygon/VGGExporter';
import * as crypto from 'crypto';
import { BrowserDetection } from '../../utils/BrowserDetection';
import { IndexedDBStorage } from './IndexedDBStorage';

export class BackupManager {
    // Store directory handle for automatic backups
    private static directoryHandle: any = null;
    // Store selected export label type for automatic exports
    private static exportLabelType: LabelType = LabelType.POLYGON;
    /**
     * Generate the full path for the backup file
     */
    private static getBackupFilePath(): string {
        const state = store.getState().backup;
        const projectName = state.projectName || store.getState().general.projectData.name || 'untitled-project';

        // Sanitize project name for file system
        const safeProjectName = projectName.replace(/[^a-z0-9_-]/gi, '_');
        const fileName = `${safeProjectName}.json`;

        if (state.storageLocation === 'custom' && state.customFolderPath) {
            // For browser environment, we'll just return the filename
            // The actual folder selection will be handled by the File System Access API
            return `${state.customFolderPath}/${fileName}`;
        }

        // Default location - we'll construct this based on platform
        return this.getDefaultBackupFilePath(fileName);
    }

    /**
     * Get default backup path based on OS
     * Note: In browser environment, this is a suggested path
     * Actual implementation will use File System Access API
     */
    private static getDefaultBackupFilePath(fileName: string): string {
        // Since we're in a browser, we'll use a standard Downloads folder path
        // The actual save will be handled by browser's download mechanism or File System Access API
        const userHome = this.getUserHomeDirectory();
        return `${userHome}/makesense-backups/${fileName}`;
    }

    /**
     * Get user home directory (platform-specific)
     */
    private static getUserHomeDirectory(): string {
        // In browser context, we'll return a placeholder
        // The actual path will be determined by the browser's file system API
        if (typeof window !== 'undefined') {
            // Browser environment - return placeholder
            return '~/';
        }
        // This would work in Node.js/Electron environment
        // const os = require('os');
        // return os.homedir();
        return '~/';
    }

    /**
     * Generate backup data object
     */
    private static generateBackupData(): BackupFile {
        const labelsState: LabelsState = store.getState().labels;
        const generalState: GeneralState = store.getState().general;

        const annotationCount = this.countTotalAnnotations(labelsState);

        const backupData: BackupFile = {
            metadata: {
                projectName: generalState.projectData.name,
                projectType: generalState.projectData.type,
                backupTimestamp: new Date().toISOString(),
                makesenseVersion: '1.11.0',
                imageCount: labelsState.imagesData.length,
                annotationCount: annotationCount,
            },
            labels: labelsState,
            general: {
                projectData: generalState.projectData,
                zoom: generalState.zoom,
                enablePerClassColoration: generalState.enablePerClassColoration,
            },
            checksum: '',
        };

        // Calculate checksum for integrity
        backupData.checksum = this.calculateChecksum(backupData);

        return backupData;
    }

    /**
     * Count total annotations across all images
     */
    private static countTotalAnnotations(labelsState: LabelsState): number {
        return labelsState.imagesData.reduce((total, image) => {
            return (
                total +
                image.labelRects.length +
                image.labelPoints.length +
                image.labelPolygons.length +
                image.labelLines.length
            );
        }, 0);
    }

    /**
     * Calculate checksum for backup data
     */
    private static calculateChecksum(data: any): string {
        // Simple checksum using JSON stringification
        // In production, you might want to use a more robust hashing algorithm
        const dataString = JSON.stringify(data.labels);
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Set the directory handle for automatic backups
     */
    public static setDirectoryHandle(handle: any): void {
        this.directoryHandle = handle;
        console.log('Directory handle set for automatic backups:', handle?.name);
    }

    /**
     * Get the current directory handle
     */
    public static getDirectoryHandle(): any {
        return this.directoryHandle;
    }

    /**
     * Set the export label type for automatic backups
     */
    public static setExportLabelType(labelType: LabelType): void {
        this.exportLabelType = labelType;
        console.log('Export label type set for automatic exports:', labelType);
    }

    /**
     * Get the current export label type
     */
    public static getExportLabelType(): LabelType {
        return this.exportLabelType;
    }

    /**
     * Get the default export format for a given label type
     * Returns the last format in the ExportFormatData array for that type
     */
    private static getDefaultExportFormat(labelType: LabelType): AnnotationFormatType {
        const formats = ExportFormatData[labelType];
        if (!formats || formats.length === 0) {
            throw new Error(`No export formats available for label type: ${labelType}`);
        }
        // Return the last format (default as per user requirement)
        return formats[formats.length - 1].type;
    }

    /**
     * Generate export content using the same logic as manual export
     * Returns the export content as a string without saving it
     */
    private static generateExportContent(labelType: LabelType, formatType: AnnotationFormatType): { content: string; extension: string } | null {
        let content: string | null = null;
        let extension: string;

        try {
            console.log(`Generating export content for ${labelType} in ${formatType} format`);

            switch (labelType) {
                case LabelType.POLYGON:
                    if (formatType === AnnotationFormatType.COCO) {
                        content = COCOExporter.getExportContent();
                        extension = 'json';
                    } else if (formatType === AnnotationFormatType.VGG) {
                        content = VGGExporter.getExportContent();
                        extension = 'json';
                    } else {
                        console.warn(`Unsupported format ${formatType} for POLYGON`);
                        return null;
                    }
                    break;

                case LabelType.RECT:
                    content = RectLabelsExporter.getExportContent(formatType);
                    extension = 'csv';
                    if (!content) {
                        console.warn(`Format ${formatType} not supported for automatic export. Only CSV is supported.`);
                        return null;
                    }
                    break;

                case LabelType.POINT:
                    if (formatType === AnnotationFormatType.CSV) {
                        content = PointLabelsExporter.getExportContent();
                        extension = 'csv';
                    } else {
                        console.warn(`Unsupported format ${formatType} for POINT`);
                        return null;
                    }
                    break;

                case LabelType.LINE:
                    if (formatType === AnnotationFormatType.CSV) {
                        content = LineLabelsExporter.getExportContent();
                        extension = 'csv';
                    } else {
                        console.warn(`Unsupported format ${formatType} for LINE`);
                        return null;
                    }
                    break;

                default:
                    console.warn(`Unknown label type: ${labelType}`);
                    return null;
            }

            if (!content || content.length === 0) {
                console.warn('Generated content is empty or null');
                return null;
            }

            console.log(`Successfully generated ${content.length} characters of export content`);
            return { content, extension };
        } catch (error) {
            console.error('Error generating export content:', error);
            return null;
        }
    }

    /**
     * Perform automatic export based on the user-selected export label type
     * Saves the export file to the same directory as the backup
     */
    public static async performAutomaticExport(): Promise<void> {
        try {
            // Get the user-selected export label type
            const exportLabelType = this.exportLabelType;

            if (!exportLabelType) {
                console.warn('No export label type set. Skipping automatic export.');
                return;
            }

            // Get the default export format for this label type
            const exportFormat = this.getDefaultExportFormat(exportLabelType);

            console.log(`Performing automatic export for ${exportLabelType} in ${exportFormat} format`);

            // Generate export content
            const exportData = this.generateExportContent(exportLabelType, exportFormat);

            if (!exportData) {
                console.warn('Could not generate export content for automatic export');
                return;
            }

            // Check if browser supports File System Access API
            const supportsFileSystemAPI = BrowserDetection.supportsFileSystemAccess();

            // Save to backup directory
            if (supportsFileSystemAPI && this.directoryHandle) {
                // Use File System Access API with directory handle
                await this.saveExportToDirectory(exportData.content, exportData.extension);
            } else if (!supportsFileSystemAPI) {
                // Use IndexedDB for browsers without File System Access API
                await this.saveExportToDirectory(exportData.content, exportData.extension);
            } else {
                console.warn('No directory handle available for automatic export. Backups will be stored in IndexedDB or downloaded.');
            }
        } catch (error) {
            console.error('Automatic export failed:', error);
            // Don't throw - we don't want to break the backup process
        }
    }

    /**
     * Save export file to the backup directory
     * @param content - The export content to save
     * @param extension - File extension (json, csv, etc.)
     * @param includeTimestamp - If true, adds timestamp to filename (for manual backups)
     */
    private static async saveExportToDirectory(content: string, extension: string, includeTimestamp: boolean = false): Promise<void> {
        const state = store.getState();
        const projectName = state.general.projectData.name || 'untitled-project';
        const safeProjectName = projectName.replace(/[^a-z0-9_-]/gi, '_');

        let fileName: string;
        if (includeTimestamp) {
            // Generate timestamp for manual backups
            const date = new Date();
            const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
            fileName = `labels_${safeProjectName}_${timestamp}.${extension}`;
        } else {
            // Automatic backups - no timestamp (overwrites same file)
            fileName = `labels_${safeProjectName}.${extension}`;
        }

        // Check if browser supports File System Access API
        if (BrowserDetection.supportsFileSystemAccess() && this.directoryHandle) {
            // Use File System Access API (Chrome, Edge, Opera)
            // Get or create file handle in the directory
            // @ts-ignore - File System Access API types
            const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });

            // Write to the file
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            console.log(`Export saved to directory: ${fileName}`);
        } else {
            // Use IndexedDB for browsers without File System Access API (Firefox, Safari, etc.)
            await IndexedDBStorage.saveFile(fileName, content, projectName);
            console.log(`Export saved to IndexedDB: ${fileName}`);
        }
    }

    /**
     * Save backup to file
     * @param isAutomatic - If true, uses directory handle or download mechanism
     *                      If false, tries File System API (manual backup with user gesture)
     */
    public static async saveBackup(isAutomatic: boolean = false): Promise<void> {
        try {
            store.dispatch(updateBackupStatus('saving'));

            const backupData = this.generateBackupData();
            const filePath = this.getBackupFilePath();
            const jsonString = JSON.stringify(backupData, null, 2);

            // Check if browser supports File System Access API
            const supportsFileSystemAPI = BrowserDetection.supportsFileSystemAccess();

            if (isAutomatic) {
                // Automatic backup
                if (supportsFileSystemAPI && this.directoryHandle) {
                    // Use File System Access API with directory handle
                    await this.saveToDirectory(jsonString, filePath);
                } else if (!supportsFileSystemAPI) {
                    // Use IndexedDB for browsers without File System Access API (Firefox, Safari, etc.)
                    const fileName = filePath.split('/').pop() || 'backup.json';
                    const projectName = store.getState().general.projectData.name || 'untitled-project';
                    await IndexedDBStorage.saveFile(fileName, jsonString, projectName);
                    console.log(`Backup saved to IndexedDB: ${fileName}`);
                } else {
                    // Fallback: Use download mechanism
                    this.saveUsingDownload(jsonString, filePath);
                }
            } else {
                // Manual backup
                if (supportsFileSystemAPI) {
                    // Use File System API for manual backup (user gesture)
                    await this.saveUsingFileSystemAPI(jsonString, filePath);
                } else {
                    // For browsers without File System Access API, use download
                    this.saveUsingDownload(jsonString, filePath);
                }
            }

            console.log(`Backup saved: ${filePath} (${isAutomatic ? 'automatic' : 'manual'})`);

            // Update Redux state
            store.dispatch(updateBackupStatus('success'));
            store.dispatch(updateLastBackupTime(new Date()));
            store.dispatch(updateBackupFilePath(filePath));

            // Return to idle after animation completes
            setTimeout(() => {
                if (store.getState().backup.status === 'success') {
                    store.dispatch(updateBackupStatus('idle'));
                }
            }, 1500);
        } catch (error) {
            console.error('Backup failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown backup error';
            store.dispatch(updateBackupError(errorMessage));
        }
    }

    /**
     * Save to a specific directory using stored directory handle
     * This allows automatic backups to write directly to user's chosen folder
     */
    private static async saveToDirectory(
        content: string,
        suggestedPath: string
    ): Promise<void> {
        if (!this.directoryHandle) {
            throw new Error('No directory handle available');
        }

        // Extract filename from path
        const fileName = suggestedPath.split('/').pop() || 'backup.json';

        // Get or create file handle in the directory
        // @ts-ignore - File System Access API types
        const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });

        // Write to the file (overwrites existing content)
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    /**
     * Save using modern File System Access API
     * This allows writing to a specific location without downloads
     */
    private static async saveUsingFileSystemAPI(
        content: string,
        suggestedPath: string
    ): Promise<void> {
        // Extract filename from path
        const fileName = suggestedPath.split('/').pop() || 'backup.json';

        // @ts-ignore - File System Access API types
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
                {
                    description: 'JSON Files',
                    accept: {
                        'application/json': ['.json'],
                    },
                },
            ],
        });

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    /**
     * Fallback: Save using browser download mechanism
     */
    private static saveUsingDownload(content: string, filePath: string): void {
        const fileName = filePath.split('/').pop() || 'backup.json';
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Manual backup trigger (user gesture - exports with timestamp)
     */
    public static async triggerManualBackup(): Promise<void> {
        const backupState = store.getState().backup;

        if (!backupState.isEnabled) {
            console.warn('Backup is not enabled. Enabling temporarily for manual backup.');
        }

        // Perform manual export with timestamp
        await this.performManualExport();
    }

    /**
     * Perform manual export with timestamp in filename
     */
    public static async performManualExport(): Promise<void> {
        try {
            const exportLabelType = this.exportLabelType;

            if (!exportLabelType) {
                console.warn('No export label type set. Skipping manual export.');
                return;
            }

            const exportFormat = this.getDefaultExportFormat(exportLabelType);
            console.log(`Performing manual export for ${exportLabelType} in ${exportFormat} format`);

            const exportData = this.generateExportContent(exportLabelType, exportFormat);

            if (!exportData) {
                console.warn('Could not generate export content for manual export');
                return;
            }

            if (this.directoryHandle) {
                // Save with timestamp for manual exports
                await this.saveExportToDirectory(exportData.content, exportData.extension, true);
                console.log('Manual export completed with timestamp');
            } else {
                console.warn('No directory handle available for manual export');
            }
        } catch (error) {
            console.error('Manual export failed:', error);
        }
    }

    /**
     * Get backup file path for display purposes
     */
    public static getDisplayFilePath(): string {
        const state = store.getState().backup;
        return state.backupFilePath || this.getBackupFilePath();
    }
}
