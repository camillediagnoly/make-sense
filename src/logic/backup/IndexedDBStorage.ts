/**
 * IndexedDB storage solution for browsers that don't support File System Access API
 * This provides a fallback storage mechanism for Firefox and other browsers
 */

export interface StoredFile {
    fileName: string;
    content: string;
    timestamp: number;
    projectName: string;
}

export class IndexedDBStorage {
    private static readonly DB_NAME = 'MakeSenseBackup';
    private static readonly DB_VERSION = 1;
    private static readonly STORE_NAME = 'backupFiles';

    /**
     * Initialize/open the IndexedDB database
     */
    private static openDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const objectStore = db.createObjectStore(this.STORE_NAME, {
                        keyPath: 'fileName',
                    });

                    // Create indexes for querying
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('projectName', 'projectName', { unique: false });
                }
            };
        });
    }

    /**
     * Save a file to IndexedDB
     * This will clear all existing backup files before saving the new one,
     * ensuring only the latest backup is kept
     */
    public static async saveFile(fileName: string, content: string, projectName: string): Promise<void> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(this.STORE_NAME);

            // First, clear all existing files from IndexedDB
            const clearRequest = objectStore.clear();

            clearRequest.onsuccess = () => {
                // Now save the new file
                const fileData: StoredFile = {
                    fileName,
                    content,
                    timestamp: Date.now(),
                    projectName,
                };

                const putRequest = objectStore.put(fileData);

                putRequest.onsuccess = () => {
                    const timestamp = new Date().toLocaleString();
                    console.log(`[${timestamp}] Backup saved: ${fileName}`);
                    resolve();
                };

                putRequest.onerror = () => {
                    reject(new Error(`Failed to save file: ${fileName}`));
                };
            };

            clearRequest.onerror = () => {
                reject(new Error('Failed to clear existing files'));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Get a file from IndexedDB
     */
    public static async getFile(fileName: string): Promise<StoredFile | null> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(this.STORE_NAME);

            const request = objectStore.get(fileName);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error(`Failed to retrieve file: ${fileName}`));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Get all files for a specific project
     */
    public static async getProjectFiles(projectName: string): Promise<StoredFile[]> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(this.STORE_NAME);
            const index = objectStore.index('projectName');

            const request = index.getAll(projectName);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error(`Failed to retrieve files for project: ${projectName}`));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Get all stored files
     */
    public static async getAllFiles(): Promise<StoredFile[]> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readonly');
            const objectStore = transaction.objectStore(this.STORE_NAME);

            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('Failed to retrieve all files'));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Delete a file from IndexedDB
     */
    public static async deleteFile(fileName: string): Promise<void> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(this.STORE_NAME);

            const request = objectStore.delete(fileName);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error(`Failed to delete file: ${fileName}`));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Download a file from IndexedDB to the user's computer
     * This provides a way for users to export their backup files
     */
    public static async downloadFile(fileName: string): Promise<void> {
        const file = await this.getFile(fileName);

        if (!file) {
            throw new Error(`File not found: ${fileName}`);
        }

        // Create a blob and trigger download
        const blob = new Blob([file.content], { type: 'application/json' });
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
     * Download all files for a project
     */
    public static async downloadAllProjectFiles(projectName: string): Promise<void> {
        const files = await this.getProjectFiles(projectName);

        for (const file of files) {
            await this.downloadFile(file.fileName);
            // Small delay between downloads to avoid browser blocking
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    /**
     * Download all files from IndexedDB with their original filenames
     */
    public static async downloadAllFiles(): Promise<void> {
        const files = await this.getAllFiles();

        if (files.length === 0) {
            return;
        }

        for (const file of files) {
            try {
                await this.downloadFile(file.fileName);
                // Small delay between downloads to avoid browser blocking
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                throw error; // Re-throw to stop the process
            }
        }
    }

    /**
     * Clear all stored files (useful for testing or cleanup)
     */
    public static async clearAllFiles(): Promise<void> {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(this.STORE_NAME);

            const request = objectStore.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear all files'));
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    }

    /**
     * Get storage usage information
     */
    public static async getStorageInfo(): Promise<{ fileCount: number; totalSize: number }> {
        const files = await this.getAllFiles();

        const totalSize = files.reduce((sum, file) => {
            return sum + new Blob([file.content]).size;
        }, 0);

        return {
            fileCount: files.length,
            totalSize,
        };
    }
}
