import { saveAs } from 'file-saver';
import { store } from '../../index';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { ImageData } from '../../store/labels/types';
import { INotification } from '../../store/notifications/types';
import { submitNewNotification } from '../../store/notifications/actionCreators';
import { LocalFileSystemDirectoryHandle } from '../../interfaces/IFileSystemAccess';
import { DirectoryFileCopy, FileSystemAccessUtil } from '../../utils/FileSystemAccessUtil';
import { NotificationUtil } from '../../utils/NotificationUtil';

export class ImageExportActions {
    // Asked for on the first copy of a project, then reused until a copy fails or the project is
    // closed.
    private static exportDirectoryHandle: LocalFileSystemDirectoryHandle | null = null;

    // Copies run one after another, so pressing again while the folder picker is open or a copy is
    // still writing neither opens a second picker nor races for a file name.
    private static pendingTask: Promise<void> = Promise.resolve();

    public static copyActiveImageToExportFolder(): Promise<void> {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        if (imageData) {
            ImageExportActions.pendingTask = ImageExportActions.pendingTask.then(() =>
                ImageExportActions.copyFileToExportFolder(imageData.fileData)
            );
        }
        return ImageExportActions.pendingTask;
    }

    public static forgetExportFolder(): void {
        ImageExportActions.exportDirectoryHandle = null;
    }

    private static async copyFileToExportFolder(file: File): Promise<void> {
        if (!FileSystemAccessUtil.supportsDirectoryPicker()) {
            // without folder access, the download folder is the only place the browser can copy to
            saveAs(file, file.name);
            return;
        }

        try {
            if (!ImageExportActions.exportDirectoryHandle) {
                ImageExportActions.exportDirectoryHandle =
                    await FileSystemAccessUtil.showExportDirectoryPicker();
            }

            const directoryHandle = ImageExportActions.exportDirectoryHandle;
            const copy = await FileSystemAccessUtil.copyFileToDirectory(file, directoryHandle);
            store.dispatch(submitNewNotification(
                ImageExportActions.createCopyNotification(file, copy, directoryHandle.name)
            ));
        } catch (error) {
            // the folder picker was dismissed
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }

            // the folder may be gone or no longer writable, so the next copy asks for it again
            ImageExportActions.forgetExportFolder();
            const reason = error instanceof Error ? error.message : String(error);
            store.dispatch(submitNewNotification(NotificationUtil.createErrorNotification({
                header: 'Image not copied',
                description: `${file.name} could not be copied to the export folder: ${reason} ` +
                    'The next copy will ask for the folder again.',
            })));
        }
    }

    private static createCopyNotification(
        file: File,
        copy: DirectoryFileCopy,
        directoryName: string
    ): INotification {
        if (copy.isAlreadyPresent) {
            return NotificationUtil.createMessageNotification({
                header: 'Image already copied',
                description: `${copy.fileName} is already in the "${directoryName}" folder.`,
            });
        }

        return NotificationUtil.createSuccessNotification({
            header: 'Image copied',
            description: copy.fileName === file.name
                ? `${file.name} was copied to the "${directoryName}" folder.`
                : `${file.name} was copied to the "${directoryName}" folder as ${copy.fileName}, ` +
                    'since a different file there already has that name.',
        });
    }
}
