import {
    FileSystemAccessDataTransferItem,
    FileSystemAccessWindow,
    LocalFileSelection,
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from "../interfaces/IFileSystemAccess";
import { ImageData } from "../store/labels/types";

export class FileSystemAccessUtil {
    private static readonly DIRECTORY_HANDLES_DB_NAME = 'make-sense-file-system-access';
    private static readonly DIRECTORY_HANDLES_DB_VERSION = 1;
    private static readonly DIRECTORY_HANDLES_STORE_NAME = 'directory-handles';
    private static readonly IMAGE_DIRECTORY_HANDLES_KEY = 'image-directory-handles';
    private static readonly MAX_REMEMBERED_DIRECTORY_HANDLES = 10;

    public static supportsFilePicker(): boolean {
        return typeof window !== 'undefined'
            && typeof (window as FileSystemAccessWindow).showOpenFilePicker === 'function';
    }

    public static supportsDirectoryPicker(): boolean {
        return typeof window !== 'undefined'
            && typeof (window as FileSystemAccessWindow).showDirectoryPicker === 'function';
    }

    public static supportsLocalFileDeletion(): boolean {
        return FileSystemAccessUtil.supportsFilePicker()
            && FileSystemAccessUtil.supportsDirectoryPicker();
    }

    public static canDeleteLocalFile(imageData: ImageData): boolean {
        return FileSystemAccessUtil.supportsLocalFileDeletion()
            && (!!imageData?.fileHandle || !!imageData?.directoryHandle?.removeEntry);
    }

    public static async localImageFileExists(imageData: ImageData): Promise<boolean | null> {
        if (!imageData) {
            return null;
        }

        if (imageData.directoryHandle?.getFileHandle) {
            try {
                await imageData.directoryHandle.getFileHandle(imageData.fileData.name);
                return true;
            } catch (error) {
                return FileSystemAccessUtil.isFileNotFoundError(error) ? false : null;
            }
        }

        if (imageData.fileHandle?.getFile) {
            try {
                await imageData.fileHandle.getFile();
                return true;
            } catch (error) {
                return FileSystemAccessUtil.isFileNotFoundError(error) ? false : null;
            }
        }

        return null;
    }

    public static needsDirectoryAccess(selections: LocalFileSelection[]): boolean {
        return FileSystemAccessUtil.supportsDirectoryPicker()
            && selections.some((selection: LocalFileSelection) =>
                selection.file && !selection.directoryHandle
            );
    }

    public static async showOpenImageFilePicker(): Promise<LocalFileSelection[]> {
        if (!FileSystemAccessUtil.supportsFilePicker()) {
            return [];
        }

        const handles = await (window as FileSystemAccessWindow).showOpenFilePicker({
            mode: 'readwrite',
            multiple: true,
            excludeAcceptAllOption: false,
            types: [
                {
                    description: 'Images',
                    accept: {
                        'image/*': ['.jpg', '.jpeg', '.png'],
                    },
                },
            ],
        });

        return Promise.all(
            handles.map(async (fileHandle: LocalFileSystemFileHandle) => ({
                file: await fileHandle.getFile(),
                fileHandle,
            }))
        );
    }

    public static async attachStoredDirectoryAccessToSelections(
        selections: LocalFileSelection[]
    ): Promise<LocalFileSelection[]> {
        if (!FileSystemAccessUtil.needsDirectoryAccess(selections)) {
            return selections;
        }

        const directoryHandles = await FileSystemAccessUtil.getRememberedDirectoryHandles();
        let nextSelections = selections;

        for (const directoryHandle of directoryHandles) {
            if (!FileSystemAccessUtil.needsDirectoryAccess(nextSelections)) {
                break;
            }

            const hasPermission = await FileSystemAccessUtil.requestReadWritePermission(directoryHandle);
            if (!hasPermission) {
                continue;
            }

            nextSelections = await FileSystemAccessUtil.attachDirectoryHandleToSelections(
                nextSelections,
                directoryHandle
            );
        }

        return nextSelections;
    }

    public static async attachDirectoryAccessToSelections(
        selections: LocalFileSelection[]
    ): Promise<LocalFileSelection[]> {
        if (!FileSystemAccessUtil.needsDirectoryAccess(selections)) {
            return selections;
        }

        try {
            const directoryHandle = await (window as FileSystemAccessWindow).showDirectoryPicker({
                mode: 'readwrite',
                startIn: selections[0].fileHandle,
            });
            await FileSystemAccessUtil.ensureReadWritePermission(directoryHandle);
            await FileSystemAccessUtil.rememberDirectoryHandle(directoryHandle);

            return FileSystemAccessUtil.attachDirectoryHandleToSelections(
                selections,
                directoryHandle
            );
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error selecting image directory:', error);
            }
            return selections;
        }
    }

    public static async showOpenImageDirectoryPicker(): Promise<LocalFileSelection[]> {
        if (!FileSystemAccessUtil.supportsDirectoryPicker()) {
            return [];
        }

        const directoryHandle = await (window as FileSystemAccessWindow).showDirectoryPicker({
            mode: 'readwrite',
        });

        return FileSystemAccessUtil.getImageFilesFromDirectoryHandle(directoryHandle);
    }

    public static async getImageFilesFromDirectoryHandle(
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<LocalFileSelection[]> {
        await FileSystemAccessUtil.ensureReadWritePermission(directoryHandle);
        await FileSystemAccessUtil.rememberDirectoryHandle(directoryHandle);
        return FileSystemAccessUtil.getImageFilesFromDirectoryWithSnapshot(directoryHandle);
    }

    public static getDirectoryImageFileNamesFromSelections(
        selections: LocalFileSelection[]
    ): string[] {
        return FileSystemAccessUtil.getDirectoryImageFileNames(selections);
    }

    public static async getImageFilesFromDataTransferItems(
        items: DataTransferItemList
    ): Promise<LocalFileSelection[]> {
        const selections: LocalFileSelection[] = [];
        const fileItems = (Array.from(items) as FileSystemAccessDataTransferItem[])
            .filter((item: FileSystemAccessDataTransferItem) => item.kind === 'file');

        const handlePromises = fileItems.map((item: FileSystemAccessDataTransferItem) =>
            item.getAsFileSystemHandle
                ? item.getAsFileSystemHandle()
                : Promise.resolve(null)
        );
        const handles = await Promise.all(handlePromises);

        for (let index = 0; index < fileItems.length; index++) {
            const item = fileItems[index];
            const handle = handles[index];

            if (handle?.kind === 'file') {
                const file = await handle.getFile();
                if (FileSystemAccessUtil.isSupportedImageFile(file)) {
                    selections.push({
                        file,
                        fileHandle: handle,
                    });
                }
                continue;
            }

            if (handle?.kind === 'directory') {
                const hasReadWritePermission = await FileSystemAccessUtil.requestReadWritePermission(handle);
                if (hasReadWritePermission) {
                    await FileSystemAccessUtil.rememberDirectoryHandle(handle);
                }

                selections.push(
                    ...await FileSystemAccessUtil.getImageFilesFromDirectoryWithSnapshot(handle)
                );
                continue;
            }

            const file = item.getAsFile();
            if (file && FileSystemAccessUtil.isSupportedImageFile(file)) {
                selections.push({ file });
            }
        }

        return selections;
    }

    public static async deleteLocalImageFile(imageData: ImageData): Promise<void> {
        if (imageData.fileHandle?.remove) {
            try {
                await FileSystemAccessUtil.ensureReadWritePermission(imageData.fileHandle);
                await imageData.fileHandle.remove();
                return;
            } catch (error) {
                console.warn('Direct file handle deletion failed. Falling back to directory deletion.', error);
            }
        }

        if (imageData.directoryHandle?.removeEntry) {
            await FileSystemAccessUtil.removeFileFromDirectory(
                imageData.directoryHandle,
                imageData.fileData.name
            );
            return;
        }

        if (imageData.fileHandle && FileSystemAccessUtil.supportsDirectoryPicker()) {
            const rememberedDirectoryHandle = await FileSystemAccessUtil.getRememberedDirectoryHandleForSelection({
                file: imageData.fileData,
                fileHandle: imageData.fileHandle,
            });

            if (rememberedDirectoryHandle) {
                await FileSystemAccessUtil.removeFileFromDirectory(
                    rememberedDirectoryHandle,
                    imageData.fileData.name
                );
                return;
            }

            const directoryHandle = await FileSystemAccessUtil.requestContainingDirectory(imageData.fileHandle);
            await FileSystemAccessUtil.removeFileFromDirectory(
                directoryHandle,
                imageData.fileData.name
            );
            return;
        }

        throw new Error('Local file deletion is unavailable for this image.');
    }

    private static async attachDirectoryHandleToSelections(
        selections: LocalFileSelection[],
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<LocalFileSelection[]> {
        const directorySelections = await FileSystemAccessUtil.getImageFilesFromDirectory(directoryHandle);
        const directoryImageFileNames = FileSystemAccessUtil.getDirectoryImageFileNames(directorySelections);

        return Promise.all(
            selections.map((selection: LocalFileSelection) =>
                selection.directoryHandle
                    ? {
                        ...selection,
                        directoryImageFileNames: selection.directoryImageFileNames || directoryImageFileNames,
                    }
                    : FileSystemAccessUtil.attachDirectoryHandleIfFileMatches(
                        selection,
                        directoryHandle,
                        directoryImageFileNames
                    )
            )
        );
    }

    private static async attachDirectoryHandleIfFileMatches(
        selection: LocalFileSelection,
        directoryHandle: LocalFileSystemDirectoryHandle,
        directoryImageFileNames?: string[]
    ): Promise<LocalFileSelection> {
        if (!directoryHandle.getFileHandle) {
            return selection;
        }

        try {
            const candidateFileHandle = await directoryHandle.getFileHandle(selection.file.name);
            if (selection.fileHandle && candidateFileHandle.isSameEntry) {
                const isSameEntry = await candidateFileHandle.isSameEntry(selection.fileHandle);
                return isSameEntry
                    ? {
                        ...selection,
                        directoryHandle,
                        directoryImageFileNames,
                    }
                    : selection;
            }

            const candidateFile = await candidateFileHandle.getFile();
            const isMatchingFile = candidateFile.name === selection.file.name
                && candidateFile.size === selection.file.size
                && candidateFile.lastModified === selection.file.lastModified;

            return isMatchingFile
                ? {
                    ...selection,
                    fileHandle: selection.fileHandle || candidateFileHandle,
                    directoryHandle,
                    directoryImageFileNames,
                }
                : selection;
        } catch (error) {
            return selection;
        }
    }

    private static async requestContainingDirectory(
        startIn?: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
    ): Promise<LocalFileSystemDirectoryHandle> {
        const directoryHandle = await (window as FileSystemAccessWindow).showDirectoryPicker({
            mode: 'readwrite',
            startIn,
        });

        await FileSystemAccessUtil.ensureReadWritePermission(directoryHandle);
        await FileSystemAccessUtil.rememberDirectoryHandle(directoryHandle);

        return directoryHandle;
    }

    private static async removeFileFromDirectory(
        directoryHandle: LocalFileSystemDirectoryHandle,
        fileName: string
    ): Promise<void> {
        await FileSystemAccessUtil.ensureReadWritePermission(directoryHandle);

        if (directoryHandle.getFileHandle) {
            await directoryHandle.getFileHandle(fileName);
        }

        await directoryHandle.removeEntry(fileName);
    }

    private static async getImageFilesFromDirectory(
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<LocalFileSelection[]> {
        if (!directoryHandle.values) {
            return [];
        }

        const selections: LocalFileSelection[] = [];

        for await (const handle of directoryHandle.values()) {
            if (handle.kind === 'file') {
                const file = await handle.getFile();
                if (FileSystemAccessUtil.isSupportedImageFile(file)) {
                    selections.push({
                        file,
                        fileHandle: handle,
                        directoryHandle,
                    });
                }
                continue;
            }

            selections.push(
                ...await FileSystemAccessUtil.getImageFilesFromDirectory(handle)
            );
        }

        return selections;
    }

    private static async getImageFilesFromDirectoryWithSnapshot(
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<LocalFileSelection[]> {
        const selections = await FileSystemAccessUtil.getImageFilesFromDirectory(directoryHandle);
        const directoryImageFileNames = FileSystemAccessUtil.getDirectoryImageFileNames(selections);

        return selections.map((selection: LocalFileSelection) => ({
            ...selection,
            directoryImageFileNames,
        }));
    }

    private static getDirectoryImageFileNames(selections: LocalFileSelection[]): string[] {
        const fileNames = new Set<string>();
        selections.forEach((selection: LocalFileSelection) => fileNames.add(selection.file.name));
        return Array.from(fileNames).sort((a: string, b: string) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
    }

    private static async getRememberedDirectoryHandleForSelection(
        selection: LocalFileSelection
    ): Promise<LocalFileSystemDirectoryHandle | null> {
        const directoryHandles = await FileSystemAccessUtil.getRememberedDirectoryHandles();

        for (const directoryHandle of directoryHandles) {
            const hasPermission = await FileSystemAccessUtil.requestReadWritePermission(directoryHandle);
            if (!hasPermission) {
                continue;
            }

            const directorySelections = await FileSystemAccessUtil.getImageFilesFromDirectory(directoryHandle);
            const directoryImageFileNames = FileSystemAccessUtil.getDirectoryImageFileNames(directorySelections);
            const selectionWithDirectoryHandle = await FileSystemAccessUtil.attachDirectoryHandleIfFileMatches(
                selection,
                directoryHandle,
                directoryImageFileNames
            );

            if (selectionWithDirectoryHandle.directoryHandle) {
                return directoryHandle;
            }
        }

        return null;
    }

    private static async getRememberedDirectoryHandles(): Promise<LocalFileSystemDirectoryHandle[]> {
        try {
            const database = await FileSystemAccessUtil.openDirectoryHandlesDatabase();
            if (!database) {
                return [];
            }

            return new Promise((resolve) => {
                const transaction = database.transaction(
                    FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME,
                    'readonly'
                );
                const request = transaction.objectStore(
                    FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME
                ).get(FileSystemAccessUtil.IMAGE_DIRECTORY_HANDLES_KEY);

                request.onsuccess = () => {
                    const result = request.result;
                    database.close();
                    resolve(Array.isArray(result) ? result : []);
                };

                request.onerror = () => {
                    database.close();
                    resolve([]);
                };
            });
        } catch (error) {
            console.warn('Could not read remembered image folders:', error);
            return [];
        }
    }

    private static async rememberDirectoryHandle(
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<void> {
        try {
            const database = await FileSystemAccessUtil.openDirectoryHandlesDatabase();
            if (!database) {
                return;
            }

            const rememberedDirectoryHandles = await FileSystemAccessUtil.getRememberedDirectoryHandles();
            const nextDirectoryHandles: LocalFileSystemDirectoryHandle[] = [directoryHandle];

            for (const rememberedDirectoryHandle of rememberedDirectoryHandles) {
                const isSameDirectory = await FileSystemAccessUtil.isSameEntry(
                    directoryHandle,
                    rememberedDirectoryHandle
                );

                if (!isSameDirectory) {
                    nextDirectoryHandles.push(rememberedDirectoryHandle);
                }
            }

            const directoryHandlesToStore = nextDirectoryHandles.slice(
                0,
                FileSystemAccessUtil.MAX_REMEMBERED_DIRECTORY_HANDLES
            );

            await new Promise<void>((resolve) => {
                const transaction = database.transaction(
                    FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME,
                    'readwrite'
                );
                const request = transaction.objectStore(
                    FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME
                ).put(
                    directoryHandlesToStore,
                    FileSystemAccessUtil.IMAGE_DIRECTORY_HANDLES_KEY
                );

                request.onsuccess = () => {
                    database.close();
                    resolve();
                };

                request.onerror = () => {
                    database.close();
                    resolve();
                };
            });
        } catch (error) {
            console.warn('Could not remember image folder:', error);
        }
    }

    private static openDirectoryHandlesDatabase(): Promise<IDBDatabase | null> {
        if (typeof window === 'undefined' || !window.indexedDB) {
            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(
                FileSystemAccessUtil.DIRECTORY_HANDLES_DB_NAME,
                FileSystemAccessUtil.DIRECTORY_HANDLES_DB_VERSION
            );

            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(
                    FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME
                )) {
                    database.createObjectStore(
                        FileSystemAccessUtil.DIRECTORY_HANDLES_STORE_NAME
                    );
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private static async isSameEntry(
        firstHandle: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle,
        secondHandle: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
    ): Promise<boolean> {
        if (!firstHandle.isSameEntry) {
            return false;
        }

        try {
            return firstHandle.isSameEntry(secondHandle);
        } catch (error) {
            return false;
        }
    }

    private static isFileNotFoundError(error: unknown): boolean {
        return error instanceof Error && error.name === 'NotFoundError';
    }

    private static isSupportedImageFile(file: File): boolean {
        const supportedExtensions = ['.jpg', '.jpeg', '.png'];
        const lowerName = file.name.toLowerCase();
        return file.type.startsWith('image/')
            && supportedExtensions.some((extension: string) => lowerName.endsWith(extension));
    }

    private static async requestReadWritePermission(
        handle: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
    ): Promise<boolean> {
        try {
            await FileSystemAccessUtil.ensureReadWritePermission(handle);
            return true;
        } catch (error) {
            return false;
        }
    }

    private static async ensureReadWritePermission(
        handle: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
    ): Promise<void> {
        const permissionDescriptor = { mode: 'readwrite' as const };

        if (handle.queryPermission) {
            const currentPermission = await handle.queryPermission(permissionDescriptor);
            if (currentPermission === 'granted') {
                return;
            }
        }

        if (handle.requestPermission) {
            const requestedPermission = await handle.requestPermission(permissionDescriptor);
            if (requestedPermission === 'granted') {
                return;
            }
        }

        throw new Error('Write permission was not granted for this image.');
    }
}
