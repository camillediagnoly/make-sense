import {
    FileSystemAccessWindow,
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from '../../interfaces/IFileSystemAccess';
import { LocalImageDirectoryRegistry } from '../../logic/imageRepository/LocalImageDirectoryRegistry';
import { FileSystemAccessUtil } from '../FileSystemAccessUtil';
import { ImageActions } from '../../logic/actions/ImageActions';
import { ImageDataUtil } from '../ImageDataUtil';
import { FileUtil } from '../FileUtil';
import { store } from '../../index';
import { updateImageData } from '../../store/labels/actionCreators';

const createImageFile = (name: string, contents: string, lastModified: number): File =>
    new File([contents], name, {
        type: 'image/jpeg',
        lastModified,
    });

const createDirectoryHandle = (
    files: File[]
): LocalFileSystemDirectoryHandle => {
    const fileHandles = new Map<string, LocalFileSystemFileHandle>(
        files.map((file: File) => [
            file.name,
            {
                kind: 'file',
                name: file.name,
                getFile: async () => file,
            },
        ])
    );

    return {
        kind: 'directory',
        name: 'images',
        queryPermission: async () => 'granted',
        getFileHandle: async (name: string) => {
            const fileHandle = fileHandles.get(name);
            if (!fileHandle) {
                throw new Error(`Missing file: ${name}`);
            }
            return fileHandle;
        },
        values: async function* () {
            for (const fileHandle of fileHandles.values()) {
                yield fileHandle;
            }
        },
    };
};

describe('FileSystemAccessUtil selected image folder access', () => {
    it('requires delete confirmation only for folder-tracked images', () => {
        const file = createImageFile('selected.jpg', 'one', 1);
        const selectedImage = ImageDataUtil.createImageDataFromFileData(file);
        const folderImage = ImageDataUtil.createImageDataFromFileData(
            file,
            undefined,
            undefined,
            undefined,
            'folder-id'
        );

        expect(FileSystemAccessUtil.requiresDeleteConfirmation(selectedImage)).toBe(false);
        expect(FileSystemAccessUtil.requiresDeleteConfirmation(folderImage)).toBe(true);
    });

    const fileSystemWindow = window as FileSystemAccessWindow;
    const originalShowDirectoryPicker = fileSystemWindow.showDirectoryPicker;

    beforeEach(() => {
        LocalImageDirectoryRegistry.clear();
    });

    afterEach(() => {
        fileSystemWindow.showDirectoryPicker = originalShowDirectoryPicker;
        LocalImageDirectoryRegistry.clear();
    });

    it('links only selected images while remembering the full folder snapshot', async () => {
        const selectedOne = createImageFile('selected-1.jpg', 'one', 1);
        const selectedTwo = createImageFile('selected-2.jpg', 'two', 2);
        const unselected = createImageFile('not-selected.jpg', 'three', 3);
        const directoryHandle = createDirectoryHandle([selectedOne, selectedTwo, unselected]);
        fileSystemWindow.showDirectoryPicker = async () => directoryHandle;

        const selections = await FileSystemAccessUtil.attachDirectoryAccessToSelections([
            { file: createImageFile('selected-1.jpg', 'one', 1) },
            { file: createImageFile('selected-2.jpg', 'two', 2) },
        ]);

        expect(selections.map((selection) => selection.file.name)).toEqual([
            'selected-1.jpg',
            'selected-2.jpg',
        ]);
        expect(selections.every((selection) =>
            selection.directoryHandle === directoryHandle
        )).toBe(true);
        expect(selections[0].directoryId).toBe(selections[1].directoryId);
        expect(FileSystemAccessUtil.needsDirectoryAccess(selections)).toBe(false);

        const directory = LocalImageDirectoryRegistry.getById(selections[0].directoryId);
        expect(Array.from(directory.knownImageFileNames).sort()).toEqual([
            'not-selected.jpg',
            'selected-1.jpg',
            'selected-2.jpg',
        ]);
    });

    it('deletes through pre-authorized folder access without requesting permission', async () => {
        const file = createImageFile('selected.jpg', 'one', 1);
        const requestPermission = jest.fn();
        const removeEntry = jest.fn().mockResolvedValue(undefined);
        const directoryHandle: LocalFileSystemDirectoryHandle = {
            kind: 'directory',
            name: 'images',
            queryPermission: async () => 'granted',
            requestPermission,
            getFileHandle: async () => ({
                kind: 'file',
                name: file.name,
                getFile: async () => file,
            }),
            removeEntry,
        };

        await FileSystemAccessUtil.deleteLocalImageFile(
            ImageDataUtil.createImageDataFromFileData(
                file,
                undefined,
                undefined,
                directoryHandle
            )
        );

        expect(removeEntry).toHaveBeenCalledWith(file.name);
        expect(requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission and deletes directly through a standalone file handle', async () => {
        const file = createImageFile('selected.jpg', 'one', 1);
        const requestPermission = jest.fn().mockResolvedValue('granted');
        const remove = jest.fn().mockResolvedValue(undefined);
        const fileHandle: LocalFileSystemFileHandle = {
            kind: 'file',
            name: file.name,
            getFile: async () => file,
            queryPermission: async () => 'prompt',
            requestPermission,
            remove,
        };

        await FileSystemAccessUtil.deleteLocalImageFile(
            ImageDataUtil.createImageDataFromFileData(file, undefined, fileHandle)
        );

        expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
        expect(remove).toHaveBeenCalled();
    });

    it('keeps handles for several individually dropped images without requesting permission', async () => {
        const firstFile = createImageFile('selected-1.jpg', 'one', 1);
        const secondFile = createImageFile('selected-2.jpg', 'two', 2);
        const firstRequestPermission = jest.fn();
        const secondRequestPermission = jest.fn();
        const firstHandle: LocalFileSystemFileHandle = {
            kind: 'file',
            name: firstFile.name,
            getFile: async () => firstFile,
            requestPermission: firstRequestPermission,
        };
        const secondHandle: LocalFileSystemFileHandle = {
            kind: 'file',
            name: secondFile.name,
            getFile: async () => secondFile,
            requestPermission: secondRequestPermission,
        };
        const items = [
            {
                kind: 'file',
                getAsFileSystemHandle: async () => firstHandle,
                getAsFile: () => firstFile,
            },
            {
                kind: 'file',
                getAsFileSystemHandle: async () => secondHandle,
                getAsFile: () => secondFile,
            },
        ] as unknown as DataTransferItemList;

        const selections = await FileSystemAccessUtil.getImageFilesFromDataTransferItems(items);

        expect(selections.map((selection) => selection.fileHandle)).toEqual([
            firstHandle,
            secondHandle,
        ]);
        expect(firstRequestPermission).not.toHaveBeenCalled();
        expect(secondRequestPermission).not.toHaveBeenCalled();
    });

    it('attaches a containing folder without enabling new-file discovery', async () => {
        const selected = createImageFile('selected.jpg', 'one', 1);
        const unselected = createImageFile('not-selected.jpg', 'two', 2);
        const directoryHandle = createDirectoryHandle([selected, unselected]);
        fileSystemWindow.showDirectoryPicker = async () => directoryHandle;

        const selections = await FileSystemAccessUtil.attachDirectoryAccessToSelections(
            [{ file: selected }],
            false
        );

        expect(selections).toHaveLength(1);
        expect(selections[0].directoryHandle).toBe(directoryHandle);
        expect(selections[0].directoryId).toBeUndefined();
        expect(FileSystemAccessUtil.needsDirectoryAccess(selections)).toBe(false);
    });
});

describe('ImageActions selected image refresh', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        store.dispatch(updateImageData([]));
    });

    it('reloads a modified individually selected image', async () => {
        const originalFile = createImageFile('selected.jpg', 'one', 1);
        const modifiedFile = createImageFile('selected.jpg', 'modified', 2);
        const fileHandle: LocalFileSystemFileHandle = {
            kind: 'file',
            name: originalFile.name,
            getFile: jest.fn().mockResolvedValue(modifiedFile),
        };
        const imageData = {
            ...ImageDataUtil.createImageDataFromFileData(originalFile, undefined, fileHandle),
            imgWidth: 100,
            imgHeight: 100,
        };
        jest.spyOn(FileUtil, 'loadImage').mockResolvedValue({
            width: 100,
            height: 100,
        } as HTMLImageElement);
        store.dispatch(updateImageData([imageData]));

        await ImageActions.refreshLocalImageFolders();

        const refreshedImageData = store.getState().labels.imagesData[0];
        expect(refreshedImageData.fileData.lastModified).toBe(modifiedFile.lastModified);
        expect(refreshedImageData.loadStatus).toBe(true);
    });

    it('enables refresh and removes a selected image deleted from disk', async () => {
        const file = createImageFile('selected.jpg', 'one', 1);
        const notFoundError = new Error('File no longer exists');
        notFoundError.name = 'NotFoundError';
        const fileHandle: LocalFileSystemFileHandle = {
            kind: 'file',
            name: file.name,
            getFile: jest.fn().mockRejectedValue(notFoundError),
        };
        const imageData = ImageDataUtil.createImageDataFromFileData(
            file,
            undefined,
            fileHandle
        );
        store.dispatch(updateImageData([imageData]));

        expect(ImageActions.canRefreshLocalImageFolders([imageData])).toBe(true);

        await ImageActions.refreshLocalImageFolders();

        expect(fileHandle.getFile).toHaveBeenCalled();
        expect(store.getState().labels.imagesData).toHaveLength(0);
    });
});
