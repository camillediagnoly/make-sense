import { saveAs } from 'file-saver';
import { ImageExportActions } from '../../actions/ImageExportActions';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { store } from '../../../index';
import { INotification } from '../../../store/notifications/types';
import { NotificationType } from '../../../data/enums/NotificationType';
import { ImageDataUtil } from '../../../utils/ImageDataUtil';
import { FileUtil } from '../../../utils/FileUtil';
import {
    FileSystemAccessWindow,
    LocalFileSystemDirectoryHandle,
    LocalFileSystemWritableFileStream,
} from '../../../interfaces/IFileSystemAccess';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// jsdom 19 lacks Blob.arrayBuffer, which every browser with folder access provides
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(this);
        });
    };
}

const createImageFile = (name: string, contents: string): File =>
    new File([contents], name, { type: 'image/jpeg' });

const createNotFoundError = (): Error => {
    const error = new Error('Not found');
    error.name = 'NotFoundError';
    return error;
};

// An in-memory folder that, like the browser, creates an empty file as soon as a handle is
// requested with create, before anything is written to it
const createExportDirectory = (
    initialFiles: File[] = [],
    write?: LocalFileSystemWritableFileStream['write']
) => {
    const files = new Map<string, File>(initialFiles.map((file: File) => [file.name, file]));
    const directoryHandle: LocalFileSystemDirectoryHandle = {
        kind: 'directory',
        name: 'review',
        queryPermission: async () => 'granted',
        getFileHandle: async (name: string, options?: { create?: boolean }) => {
            if (!files.has(name)) {
                if (!options?.create) {
                    throw createNotFoundError();
                }
                files.set(name, new File([], name));
            }
            return {
                kind: 'file',
                name,
                getFile: async () => files.get(name),
                createWritable: async () => ({
                    write: write || (async (data: Blob | BufferSource | string) => {
                        files.set(name, new File([data], name));
                    }),
                    close: async () => undefined,
                }),
            };
        },
        removeEntry: async (name: string) => {
            files.delete(name);
        },
    };
    return { directoryHandle, files };
};

const showActiveImage = (file: File): void => {
    jest.spyOn(LabelsSelector, 'getActiveImageData')
        .mockReturnValue(ImageDataUtil.createImageDataFromFileData(file));
};

const getNotifications = (): INotification[] =>
    (store.dispatch as jest.Mock).mock.calls.map(([action]) => action.payload.notification);

describe('ImageExportActions.copyActiveImageToExportFolder', () => {
    const fileSystemWindow = window as FileSystemAccessWindow;
    const originalShowDirectoryPicker = fileSystemWindow.showDirectoryPicker;

    beforeEach(() => {
        ImageExportActions.forgetExportFolder();
        (store.dispatch as jest.Mock).mockClear();
        (saveAs as unknown as jest.Mock).mockClear();
    });

    afterEach(() => {
        fileSystemWindow.showDirectoryPicker = originalShowDirectoryPicker;
        jest.restoreAllMocks();
    });

    it('asks for the folder once and copies the image file into it', async () => {
        const { directoryHandle, files } = createExportDirectory();
        const showDirectoryPicker = jest.fn().mockResolvedValue(directoryHandle);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;

        showActiveImage(createImageFile('first.jpg', 'one'));
        await ImageExportActions.copyActiveImageToExportFolder();
        showActiveImage(createImageFile('second.jpg', 'two'));
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(1);
        expect(showDirectoryPicker).toHaveBeenCalledWith(
            expect.objectContaining({ mode: 'readwrite', id: expect.any(String) })
        );
        expect(await FileUtil.readFile(files.get('first.jpg'))).toBe('one');
        expect(await FileUtil.readFile(files.get('second.jpg'))).toBe('two');
        expect(getNotifications().map((notification) => notification.type)).toEqual([
            NotificationType.SUCCESS,
            NotificationType.SUCCESS,
        ]);
    });

    it('opens a single picker for presses made while it is still open', async () => {
        const { directoryHandle, files } = createExportDirectory();
        const showDirectoryPicker = jest.fn().mockResolvedValue(directoryHandle);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;
        showActiveImage(createImageFile('image.jpg', 'one'));

        ImageExportActions.copyActiveImageToExportFolder();
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(1);
        expect(Array.from(files.keys())).toEqual(['image.jpg']);
    });

    it('leaves an identical file alone instead of copying it twice', async () => {
        const { directoryHandle, files } = createExportDirectory([
            createImageFile('image.jpg', 'same'),
        ]);
        fileSystemWindow.showDirectoryPicker = jest.fn().mockResolvedValue(directoryHandle);
        showActiveImage(createImageFile('image.jpg', 'same'));

        await ImageExportActions.copyActiveImageToExportFolder();

        expect(Array.from(files.keys())).toEqual(['image.jpg']);
        expect(getNotifications()[0].type).toBe(NotificationType.MESSAGE);
        expect(getNotifications()[0].header).toBe('Image already copied');
    });

    it('numbers the copy when a different file already has its name', async () => {
        const { directoryHandle, files } = createExportDirectory([
            createImageFile('image.jpg', 'other'),
            createImageFile('image (1).jpg', 'another'),
        ]);
        fileSystemWindow.showDirectoryPicker = jest.fn().mockResolvedValue(directoryHandle);
        showActiveImage(createImageFile('image.jpg', 'mine'));

        await ImageExportActions.copyActiveImageToExportFolder();
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(await FileUtil.readFile(files.get('image.jpg'))).toBe('other');
        expect(await FileUtil.readFile(files.get('image (1).jpg'))).toBe('another');
        expect(await FileUtil.readFile(files.get('image (2).jpg'))).toBe('mine');
        expect(files.size).toBe(3);
        expect(getNotifications()[0].description).toContain('as image (2).jpg');
        expect(getNotifications()[1].header).toBe('Image already copied');
    });

    it('does nothing when the folder picker is dismissed, and asks again next time', async () => {
        const abortError = new Error('The user aborted a request.');
        abortError.name = 'AbortError';
        const showDirectoryPicker = jest.fn().mockRejectedValue(abortError);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;
        showActiveImage(createImageFile('image.jpg', 'one'));

        await ImageExportActions.copyActiveImageToExportFolder();
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(2);
        expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('reports a failed copy, removes the empty file and asks for the folder again', async () => {
        const failingDirectory = createExportDirectory([], async () => {
            throw new Error('Disk full.');
        });
        const workingDirectory = createExportDirectory();
        const showDirectoryPicker = jest.fn()
            .mockResolvedValueOnce(failingDirectory.directoryHandle)
            .mockResolvedValueOnce(workingDirectory.directoryHandle);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;
        showActiveImage(createImageFile('image.jpg', 'one'));

        await ImageExportActions.copyActiveImageToExportFolder();

        expect(failingDirectory.files.size).toBe(0);
        expect(getNotifications()[0].type).toBe(NotificationType.ERROR);
        expect(getNotifications()[0].description).toContain('Disk full.');

        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(2);
        expect(await FileUtil.readFile(workingDirectory.files.get('image.jpg'))).toBe('one');
    });

    it('downloads the image in browsers without folder access', async () => {
        fileSystemWindow.showDirectoryPicker = undefined;
        const file = createImageFile('image.jpg', 'one');
        showActiveImage(file);

        await ImageExportActions.copyActiveImageToExportFolder();

        expect(saveAs).toHaveBeenCalledWith(file, 'image.jpg');
    });

    it('copies into the newly chosen folder once the export folder is changed', async () => {
        const firstDirectory = createExportDirectory();
        const secondDirectory = createExportDirectory();
        const showDirectoryPicker = jest.fn()
            .mockResolvedValueOnce(firstDirectory.directoryHandle)
            .mockResolvedValueOnce(secondDirectory.directoryHandle);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;
        showActiveImage(createImageFile('image.jpg', 'one'));

        await ImageExportActions.copyActiveImageToExportFolder();
        await ImageExportActions.changeExportFolder();
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(2);
        expect(showDirectoryPicker).toHaveBeenLastCalledWith(
            expect.objectContaining({ mode: 'readwrite', id: expect.any(String) })
        );
        expect(Array.from(firstDirectory.files.keys())).toEqual(['image.jpg']);
        expect(Array.from(secondDirectory.files.keys())).toEqual(['image.jpg']);
        expect(getNotifications()[1].header).toBe('Export folder changed');
    });

    it('keeps the current export folder when the change is dismissed', async () => {
        const { directoryHandle, files } = createExportDirectory();
        const abortError = new Error('The user aborted a request.');
        abortError.name = 'AbortError';
        const showDirectoryPicker = jest.fn()
            .mockResolvedValueOnce(directoryHandle)
            .mockRejectedValueOnce(abortError);
        fileSystemWindow.showDirectoryPicker = showDirectoryPicker;

        showActiveImage(createImageFile('first.jpg', 'one'));
        await ImageExportActions.copyActiveImageToExportFolder();
        await ImageExportActions.changeExportFolder();
        showActiveImage(createImageFile('second.jpg', 'two'));
        await ImageExportActions.copyActiveImageToExportFolder();

        expect(showDirectoryPicker).toHaveBeenCalledTimes(2);
        expect(Array.from(files.keys())).toEqual(['first.jpg', 'second.jpg']);
    });
});
