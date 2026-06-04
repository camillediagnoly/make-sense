export type LocalFileSystemPermissionMode = 'read' | 'readwrite';

export type LocalFileSystemPermissionDescriptor = {
    mode?: LocalFileSystemPermissionMode;
};

export type LocalFileSystemFileHandle = {
    kind: 'file';
    name: string;
    getFile: () => Promise<File>;
    isSameEntry?: (other: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle) => Promise<boolean>;
    queryPermission?: (descriptor?: LocalFileSystemPermissionDescriptor) => Promise<PermissionState>;
    requestPermission?: (descriptor?: LocalFileSystemPermissionDescriptor) => Promise<PermissionState>;
    remove?: () => Promise<void>;
};

export type LocalFileSystemDirectoryHandle = {
    kind: 'directory';
    name: string;
    values?: () => AsyncIterable<LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle>;
    getFileHandle?: (name: string, options?: { create?: boolean }) => Promise<LocalFileSystemFileHandle>;
    isSameEntry?: (other: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle) => Promise<boolean>;
    queryPermission?: (descriptor?: LocalFileSystemPermissionDescriptor) => Promise<PermissionState>;
    requestPermission?: (descriptor?: LocalFileSystemPermissionDescriptor) => Promise<PermissionState>;
    remove?: () => Promise<void>;
    removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
};

export type LocalFileSelection = {
    file: File;
    fileHandle?: LocalFileSystemFileHandle;
    directoryHandle?: LocalFileSystemDirectoryHandle;
    directoryImageFileNames?: string[];
};

export type FileSystemAccessWindow = Window & {
    showDirectoryPicker?: (options?: {
        mode?: LocalFileSystemPermissionMode;
        startIn?: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle | string;
    }) => Promise<LocalFileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: {
        mode?: LocalFileSystemPermissionMode;
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
        types?: Array<{
            description?: string;
            accept: Record<string, string[]>;
        }>;
    }) => Promise<LocalFileSystemFileHandle[]>;
};

export type FileSystemAccessDataTransferItem = DataTransferItem & {
    getAsFileSystemHandle?: () => Promise<LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle | null>;
};
