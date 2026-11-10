import {
    FileSystemAccessDataTransferItem,
    FileSystemAccessWindow,
    LocalFileSystemDirectoryHandle,
    LocalFileSystemFileHandle,
} from '../../interfaces/IFileSystemAccess';

// The two folder layouts the review mode accepts:
//   <folder>/                          <folder>/
//       images/      - the images          images/    - the images
//       <name>.json  - COCO annotations    labels/    - one Pascal VOC .xml per image
export const EXPECTED_FOLDER_STRUCTURE: string[] = [
    '<your-folder>/',
    '    images/          only .jpg, .jpeg or .png images',
    '    <name>.json      the COCO annotations of these images',
    '    <name>_reviewed.json   (optional) written by "Export current folder"',
    '',
    'or',
    '',
    '<your-folder>/',
    '    images/          only .jpg, .jpeg or .png images',
    '    labels/          one Pascal VOC .xml file per image',
    '    labels_reviewed/ (optional) written by "Export current folder"',
];

export const REVIEWED_SUFFIX = '_reviewed';

export const IMAGES_FOLDER_NAME = 'images';
export const LABELS_FOLDER_NAME = 'labels';
export const REVIEWED_LABELS_FOLDER_NAME = `${LABELS_FOLDER_NAME}${REVIEWED_SUFFIX}`;
const IMAGE_EXTENSIONS: string[] = ['.jpg', '.jpeg', '.png'];
// Files the operating system drops in folders on its own: they are not part of the folder layout
const IGNORED_FILE_NAMES: string[] = ['thumbs.db', 'desktop.ini'];

export class ReviewFolderError extends Error {
    public readonly problems: string[];

    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'ReviewFolderError';
        this.problems = problems;
    }
}

type ReviewFolderBase = {
    name: string;
    // Only set in browsers with the File System Access API (Chrome, Edge)
    directoryHandle?: LocalFileSystemDirectoryHandle;
    imageFiles: File[];
};

export type COCOReviewFolder = ReviewFolderBase & {
    format: 'coco';
    // The annotations to load: <name>_reviewed.json when the folder was already exported, so the
    // review goes on from there, otherwise <name>.json
    jsonFile: File;
    // Where "Export current folder" writes, next to <name>.json (which is never overwritten)
    reviewedJsonName: string;
    // <name>.json when <name>_reviewed.json was loaded instead of it
    skippedJsonName: string | null;
};

export type VOCReviewFolder = ReviewFolderBase & {
    format: 'voc';
    // The .xml files to load: those of labels_reviewed/ when the folder was already exported, so
    // the review goes on from there, otherwise those of labels/
    labelFiles: File[];
    // The folder they were read from
    labelsFolderName: string;
    // Where "Export current folder" writes, next to labels/ (which is never overwritten)
    reviewedLabelsFolderName: string;
    // labels/ when labels_reviewed/ was loaded instead of it
    skippedLabelsFolderName: string | null;
};

export type ReviewFolder = COCOReviewFolder | VOCReviewFolder;

// A file or folder of the dropped tree, whichever browser API it comes from
type FolderEntry = {
    name: string;
    kind: 'file' | 'directory';
    getFile: () => Promise<File>;
    listChildren: () => Promise<FolderEntry[]>;
    directoryHandle?: LocalFileSystemDirectoryHandle;
};

// What a dropped item gives, read synchronously during the drop event: the browser forgets the
// dropped items as soon as the event handler returns.
export type DroppedItem = {
    handle: Promise<LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle | null> | null;
    entry: FileSystemEntry | null;
};

export class ReviewFolderReader {
    public static captureDroppedItems(dataTransfer: DataTransfer | null): DroppedItem[] {
        if (!dataTransfer || !dataTransfer.items) {
            return [];
        }
        return (Array.from(dataTransfer.items) as FileSystemAccessDataTransferItem[])
            .filter((item: FileSystemAccessDataTransferItem) => item.kind === 'file')
            .map((item: FileSystemAccessDataTransferItem) => ({
                handle: item.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch((): null => null) : null,
                entry: typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null,
            }));
    }

    public static supportsDirectoryPicker(): boolean {
        return typeof window !== 'undefined'
            && typeof (window as FileSystemAccessWindow).showDirectoryPicker === 'function';
    }

    public static async readFromDroppedItems(items: DroppedItem[]): Promise<ReviewFolder> {
        if (items.length !== 1) {
            throw new ReviewFolderError([
                items.length === 0
                    ? 'Nothing was dropped. Drop a single folder.'
                    : `${items.length} items were dropped. Drop a single folder.`
            ]);
        }

        const root: FolderEntry | null = await ReviewFolderReader.toRootEntry(items[0]);
        if (!root || root.kind !== 'directory') {
            throw new ReviewFolderError(['A file was dropped. Drop the folder that contains it instead.']);
        }
        return ReviewFolderReader.readFolder(root);
    }

    public static async readFromDirectoryPicker(): Promise<ReviewFolder> {
        const handle = await (window as FileSystemAccessWindow).showDirectoryPicker({
            id: 'make-sense-review-import',
            // Write access too: the export saves <name>_reviewed.json or labels_reviewed/ in this folder
            mode: 'readwrite',
        });
        return ReviewFolderReader.readFolder(ReviewFolderReader.fromHandle(handle));
    }

    private static async toRootEntry(item: DroppedItem): Promise<FolderEntry | null> {
        const handle = item.handle ? await item.handle : null;
        if (handle) {
            return ReviewFolderReader.fromHandle(handle);
        }
        return item.entry ? ReviewFolderReader.fromEntry(item.entry) : null;
    }

    private static async readFolder(root: FolderEntry): Promise<ReviewFolder> {
        const children: FolderEntry[] = ReviewFolderReader.withoutIgnoredFiles(await root.listChildren());
        const problems: string[] = [];

        const isDirectoryNamed = (child: FolderEntry, name: string) =>
            child.kind === 'directory' && child.name.toLowerCase() === name;
        const imagesFolders = children.filter((child: FolderEntry) => isDirectoryNamed(child, IMAGES_FOLDER_NAME));
        const labelsFolder = children.find((child: FolderEntry) => isDirectoryNamed(child, LABELS_FOLDER_NAME));
        const reviewedLabelsFolder = children
            .find((child: FolderEntry) => isDirectoryNamed(child, REVIEWED_LABELS_FOLDER_NAME));
        const labelsFolders = [labelsFolder, reviewedLabelsFolder].filter(Boolean);
        const jsonFiles = children.filter((child: FolderEntry) =>
            child.kind === 'file' && child.name.toLowerCase().endsWith('.json'));
        const unexpected = children.filter((child: FolderEntry) =>
            !imagesFolders.includes(child) && !labelsFolders.includes(child) && !jsonFiles.includes(child));

        if (imagesFolders.length === 0) {
            problems.push(`The folder "${root.name}" has no "${IMAGES_FOLDER_NAME}" folder.`);
        }

        const isVOC = labelsFolders.length > 0;
        const jsonPair = ReviewFolderReader.getJsonPair(jsonFiles);
        if (isVOC && jsonFiles.length > 0) {
            problems.push(`The folder "${root.name}" holds both a "${LABELS_FOLDER_NAME}" folder and .json `
                + `annotations (${ReviewFolderReader.listNames(jsonFiles)}): keep only one of them.`);
        } else if (!isVOC && jsonFiles.length === 0) {
            problems.push(`The folder "${root.name}" has no annotations: neither a .json file nor a `
                + `"${LABELS_FOLDER_NAME}" folder of .xml files.`);
        } else if (!isVOC && !jsonPair) {
            problems.push(`The folder "${root.name}" has ${jsonFiles.length} .json files `
                + `(${ReviewFolderReader.listNames(jsonFiles)}): it must have only one, plus `
                + `optionally its "${REVIEWED_SUFFIX}" version.`);
        }
        if (unexpected.length > 0) {
            problems.push(`The folder "${root.name}" must only hold the "${IMAGES_FOLDER_NAME}" folder and `
                + (isVOC ? `the "${LABELS_FOLDER_NAME}" folder` : 'the .json file')
                + `, but it also holds: ${ReviewFolderReader.listNames(unexpected)}.`);
        }

        let imageEntries: FolderEntry[] = [];
        if (imagesFolders.length === 1) {
            const entries = ReviewFolderReader.withoutIgnoredFiles(await imagesFolders[0].listChildren());
            const notImages = entries.filter((entry: FolderEntry) => !ReviewFolderReader.isImageEntry(entry));
            imageEntries = entries.filter((entry: FolderEntry) => ReviewFolderReader.isImageEntry(entry));

            if (notImages.length > 0) {
                problems.push(`The "${IMAGES_FOLDER_NAME}" folder must only hold .jpg, .jpeg or .png images, `
                    + `but it also holds: ${ReviewFolderReader.listNames(notImages)}.`);
            } else if (imageEntries.length === 0) {
                problems.push(`The "${IMAGES_FOLDER_NAME}" folder has no image.`);
            }
        }

        // labels_reviewed/ when the folder was already exported, so the review goes on from there
        const loadedLabelsFolder = reviewedLabelsFolder || labelsFolder;
        let labelEntries: FolderEntry[] = [];
        if (isVOC && jsonFiles.length === 0) {
            const entries = ReviewFolderReader.withoutIgnoredFiles(await loadedLabelsFolder.listChildren());
            const notLabels = entries.filter((entry: FolderEntry) => !ReviewFolderReader.isXmlEntry(entry));
            labelEntries = entries.filter((entry: FolderEntry) => ReviewFolderReader.isXmlEntry(entry));

            if (notLabels.length > 0) {
                problems.push(`The "${loadedLabelsFolder.name}" folder must only hold .xml files, `
                    + `but it also holds: ${ReviewFolderReader.listNames(notLabels)}.`);
            } else if (labelEntries.length === 0) {
                problems.push(`The "${loadedLabelsFolder.name}" folder has no .xml file.`);
            }
        }

        if (problems.length > 0) {
            throw new ReviewFolderError(problems);
        }

        const base: ReviewFolderBase = {
            name: root.name,
            directoryHandle: root.directoryHandle,
            imageFiles: await Promise.all(imageEntries.map((entry: FolderEntry) => entry.getFile())),
        };
        if (isVOC) {
            return {
                ...base,
                format: 'voc',
                labelFiles: await Promise.all(labelEntries.map((entry: FolderEntry) => entry.getFile())),
                labelsFolderName: loadedLabelsFolder.name,
                reviewedLabelsFolderName: reviewedLabelsFolder ? reviewedLabelsFolder.name : REVIEWED_LABELS_FOLDER_NAME,
                skippedLabelsFolderName: reviewedLabelsFolder && labelsFolder ? labelsFolder.name : null,
            };
        }
        return {
            ...base,
            format: 'coco',
            jsonFile: await (jsonPair.reviewed || jsonPair.original).getFile(),
            reviewedJsonName: jsonPair.reviewedName,
            skippedJsonName: jsonPair.reviewed ? jsonPair.original.name : null,
        };
    }

    // One .json file, or a <name>.json with its <name>_reviewed.json
    private static getJsonPair(
        jsonFiles: FolderEntry[]
    ): { original: FolderEntry; reviewed: FolderEntry | null; reviewedName: string } | null {
        const baseName = (entry: FolderEntry) => entry.name.replace(/\.json$/i, '');
        if (jsonFiles.length === 1) {
            const [jsonFile] = jsonFiles;
            // A lone <name>_reviewed.json is written back to itself
            return baseName(jsonFile).endsWith(REVIEWED_SUFFIX)
                ? { original: jsonFile, reviewed: null, reviewedName: jsonFile.name }
                : { original: jsonFile, reviewed: null, reviewedName: `${baseName(jsonFile)}${REVIEWED_SUFFIX}.json` };
        }
        if (jsonFiles.length === 2) {
            const [first, second] = [...jsonFiles].sort((a, b) => a.name.length - b.name.length);
            if (baseName(second) === `${baseName(first)}${REVIEWED_SUFFIX}`) {
                return { original: first, reviewed: second, reviewedName: second.name };
            }
        }
        return null;
    }

    private static withoutIgnoredFiles(entries: FolderEntry[]): FolderEntry[] {
        return entries.filter((entry: FolderEntry) =>
            !entry.name.startsWith('.') && !IGNORED_FILE_NAMES.includes(entry.name.toLowerCase()));
    }

    private static isImageEntry(entry: FolderEntry): boolean {
        const name = entry.name.toLowerCase();
        return entry.kind === 'file' && IMAGE_EXTENSIONS.some((extension: string) => name.endsWith(extension));
    }

    private static isXmlEntry(entry: FolderEntry): boolean {
        return entry.kind === 'file' && entry.name.toLowerCase().endsWith('.xml');
    }

    private static listNames(entries: FolderEntry[]): string {
        const maxListed = 5;
        const names = entries
            .slice(0, maxListed)
            .map((entry: FolderEntry) => entry.kind === 'directory' ? `"${entry.name}/"` : `"${entry.name}"`);
        const rest = entries.length - maxListed;
        return rest > 0 ? `${names.join(', ')} and ${rest} more` : names.join(', ');
    }

    // =================================================================================================================
    // File System Access API (Chrome, Edge)
    // =================================================================================================================

    private static fromHandle(handle: LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle): FolderEntry {
        if (handle.kind === 'file') {
            return {
                name: handle.name,
                kind: 'file',
                getFile: () => handle.getFile(),
                listChildren: async () => [],
            };
        }
        return {
            name: handle.name,
            kind: 'directory',
            directoryHandle: handle,
            getFile: () => Promise.reject(new Error(`${handle.name} is a folder`)),
            listChildren: async () => {
                const children: FolderEntry[] = [];
                for await (const child of handle.values()) {
                    children.push(ReviewFolderReader.fromHandle(child));
                }
                return children;
            },
        };
    }

    // =================================================================================================================
    // File and Directory Entries API (Firefox, Safari)
    // =================================================================================================================

    private static fromEntry(entry: FileSystemEntry): FolderEntry {
        if (entry.isFile) {
            const fileEntry = entry as FileSystemFileEntry;
            return {
                name: entry.name,
                kind: 'file',
                getFile: () => new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject)),
                listChildren: async () => [],
            };
        }
        const directoryEntry = entry as FileSystemDirectoryEntry;
        return {
            name: entry.name,
            kind: 'directory',
            getFile: () => Promise.reject(new Error(`${entry.name} is a folder`)),
            listChildren: () => ReviewFolderReader.readAllEntries(directoryEntry)
                .then((entries: FileSystemEntry[]) => entries.map(ReviewFolderReader.fromEntry)),
        };
    }

    // readEntries only returns a batch of entries per call: it has to be called until it returns none
    private static async readAllEntries(directoryEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
        const reader = directoryEntry.createReader();
        const entries: FileSystemEntry[] = [];
        while (true) {
            const batch: FileSystemEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
            if (batch.length === 0) {
                return entries;
            }
            entries.push(...batch);
        }
    }
}
