import { v4 as uuidv4 } from 'uuid';
import { LocalFileSystemDirectoryHandle } from '../../interfaces/IFileSystemAccess';

export type LocalImageDirectoryData = {
    id: string;
    directoryHandle: LocalFileSystemDirectoryHandle;
    knownImageFileNames: Set<string>;
};

export class LocalImageDirectoryRegistry {
    private static directories: Map<string, LocalImageDirectoryData> = new Map();

    public static async register(
        directoryHandle: LocalFileSystemDirectoryHandle,
        knownImageFileNames: Iterable<string>
    ): Promise<string> {
        const existingDirectory = await LocalImageDirectoryRegistry.findByHandle(directoryHandle);

        if (existingDirectory) {
            for (const fileName of knownImageFileNames) {
                existingDirectory.knownImageFileNames.add(fileName);
            }
            return existingDirectory.id;
        }

        const id = uuidv4();
        LocalImageDirectoryRegistry.directories.set(id, {
            id,
            directoryHandle,
            knownImageFileNames: new Set(knownImageFileNames),
        });
        return id;
    }

    public static getById(id?: string): LocalImageDirectoryData | null {
        return id ? LocalImageDirectoryRegistry.directories.get(id) || null : null;
    }

    public static replaceKnownImageFileNames(id: string, fileNames: Iterable<string>): void {
        const directory = LocalImageDirectoryRegistry.getById(id);
        if (directory) {
            directory.knownImageFileNames = new Set(fileNames);
        }
    }

    public static removeKnownImageFileName(id: string | undefined, fileName: string): void {
        LocalImageDirectoryRegistry.getById(id)?.knownImageFileNames.delete(fileName);
    }

    public static clear(): void {
        LocalImageDirectoryRegistry.directories.clear();
    }

    private static async findByHandle(
        directoryHandle: LocalFileSystemDirectoryHandle
    ): Promise<LocalImageDirectoryData | null> {
        for (const directory of LocalImageDirectoryRegistry.directories.values()) {
            if (directory.directoryHandle === directoryHandle) {
                return directory;
            }

            if (directoryHandle.isSameEntry) {
                try {
                    if (await directoryHandle.isSameEntry(directory.directoryHandle)) {
                        return directory;
                    }
                } catch (error) {
                    continue;
                }
            }
        }

        return null;
    }
}
