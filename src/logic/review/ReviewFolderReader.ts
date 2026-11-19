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
export const REVIEWED_SUFFIX = '_reviewed';

export const IMAGES_FOLDER_NAME = 'images';
export const LABELS_FOLDER_NAME = 'labels';
export const REVIEWED_LABELS_FOLDER_NAME = `${LABELS_FOLDER_NAME}${REVIEWED_SUFFIX}`;
// What to do, ending most errors
const DROP_BOTH = `Please drag and drop the "${IMAGES_FOLDER_NAME}" folder and the .json file, together or one `
    + 'after the other.';
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

// The "images" folder or the .json file, dropped on its own: kept until the other one is dropped
export type PartialDrop = {
    imagesFolder: FolderEntry | null;
    // The images of imagesFolder
    imageCount: number;
    annotationsFile: FolderEntry | null;
};

export type DropResult =
    | { kind: 'folder'; folder: ReviewFolder }
    | { kind: 'partial'; partialDrop: PartialDrop };

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

    // Accepts the folder itself, or what it holds (the "images" folder and the .json file) dropped together.
    // Dropping only one of them is refused here: see readDrop to accept them one at a time.
    public static async readFromDroppedItems(items: DroppedItem[]): Promise<ReviewFolder> {
        const result: DropResult = await ReviewFolderReader.readDrop(items, null);
        if (result.kind === 'folder') {
            return result.folder;
        }
        const { imagesFolder, annotationsFile } = result.partialDrop;
        throw new ReviewFolderError([annotationsFile
            ? `Only the file "${annotationsFile.name}" was dropped. Please drag and drop it together with the `
                + `"${IMAGES_FOLDER_NAME}" folder.`
            : `Only the "${imagesFolder.name}" folder was dropped. ${DROP_BOTH}`]);
    }

    // Like readFromDroppedItems, but the "images" folder and the .json file can also come one drop at a
    // time: a drop bringing only one of them gives a partial drop, to pass along with the next drop.
    public static async readDrop(items: DroppedItem[], previous: PartialDrop | null): Promise<DropResult> {
        if (items.length === 0) {
            throw new ReviewFolderError([`Nothing was dropped. ${DROP_BOTH}`]);
        }

        const entries: FolderEntry[] = (await Promise.all(items.map(ReviewFolderReader.toRootEntry)))
            .filter((entry: FolderEntry | null): entry is FolderEntry => !!entry);
        if (entries.length === 0) {
            throw new ReviewFolderError([`What was dropped could not be read. ${DROP_BOTH}`]);
        }
        if (entries.length > 1) {
            return { kind: 'folder', folder: await ReviewFolderReader.readDroppedEntries(entries) };
        }

        const [entry] = entries;
        let partialDrop: PartialDrop;
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
            partialDrop = { imagesFolder: previous?.imagesFolder ?? null, imageCount: previous?.imageCount ?? 0,
                annotationsFile: entry };
        } else if (entry.kind === 'file') {
            throw new ReviewFolderError([`"${entry.name}" is neither the "${IMAGES_FOLDER_NAME}" folder nor a .json `
                + `file. ${DROP_BOTH}`]);
        } else {
            const imageCount = await ReviewFolderReader.countImagesOfLoneImagesFolder(entry);
            if (imageCount === null) {
                return { kind: 'folder', folder: await ReviewFolderReader.readFolder(entry) };
            }
            partialDrop = { imagesFolder: entry, imageCount, annotationsFile: previous?.annotationsFile ?? null };
        }

        if (partialDrop.imagesFolder && partialDrop.annotationsFile) {
            return {
                kind: 'folder',
                folder: await ReviewFolderReader.readDroppedEntries([partialDrop.imagesFolder, partialDrop.annotationsFile]),
            };
        }
        return { kind: 'partial', partialDrop };
    }

    // The number of images of a dropped "images" folder, or null when the dropped folder is not one: it
    // is named otherwise, or holds an "images" folder or a .json file of its own
    private static async countImagesOfLoneImagesFolder(entry: FolderEntry): Promise<number | null> {
        if (entry.name.toLowerCase() !== IMAGES_FOLDER_NAME) {
            return null;
        }
        const children: FolderEntry[] = ReviewFolderReader.withoutIgnoredFiles(await entry.listChildren());
        const holdsAFolderLayout = children.some((child: FolderEntry) =>
            (child.kind === 'directory' && child.name.toLowerCase() === IMAGES_FOLDER_NAME)
            || (child.kind === 'file' && child.name.toLowerCase().endsWith('.json')));
        return holdsAFolderLayout
            ? null
            : children.filter((child: FolderEntry) => ReviewFolderReader.isImageEntry(child)).length;
    }

    // Several dropped items, read as the content of their folder, which the browser does not give, so
    // "Save my review" asks for it, or downloads its result
    private static readDroppedEntries(entries: FolderEntry[]): Promise<ReviewFolder> {
        return ReviewFolderReader.readFolder({
            name: '',
            kind: 'directory',
            getFile: () => Promise.reject(new Error('The dropped items are not a file')),
            listChildren: async () => entries,
        });
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

    // root.name is empty when it stands for several dropped items rather than a folder
    private static async readFolder(root: FolderEntry, canOpenSubfolder: boolean = true): Promise<ReviewFolder> {
        const children: FolderEntry[] = ReviewFolderReader.withoutIgnoredFiles(await root.listChildren());
        const problems: string[] = [];
        const where = root.name ? `The folder "${root.name}"` : 'What you dropped';
        const dropOnly = (isVOCFolder: boolean) => `Please drag and drop only the "${IMAGES_FOLDER_NAME}" folder and `
            + (isVOCFolder ? `the "${LABELS_FOLDER_NAME}" folder.` : 'the .json file.');

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

        // A folder that only wraps the right one, as unzipping often makes: the right one is opened instead
        const [onlyChild] = children;
        if (canOpenSubfolder && children.length === 1 && onlyChild.kind === 'directory'
            && imagesFolders.length === 0 && labelsFolders.length === 0) {
            return ReviewFolderReader.readFolder(onlyChild, false);
        }

        const looseImages = children.filter((child: FolderEntry) => ReviewFolderReader.isImageEntry(child));
        if (imagesFolders.length === 0 && root.name.toLowerCase() === IMAGES_FOLDER_NAME && looseImages.length > 0) {
            throw new ReviewFolderError([`This is the "${IMAGES_FOLDER_NAME}" folder itself. ${DROP_BOTH}`]);
        }

        if (imagesFolders.length === 0 && looseImages.length > 0) {
            problems.push(`The pictures (${ReviewFolderReader.listNames(looseImages)}) must stay inside the `
                + `"${IMAGES_FOLDER_NAME}" folder. ${DROP_BOTH}`);
        } else if (imagesFolders.length === 0) {
            problems.push(`${where} has no "${IMAGES_FOLDER_NAME}" folder. ${DROP_BOTH}`);
        }

        const isVOC = labelsFolders.length > 0;
        const jsonPair = ReviewFolderReader.getJsonPair(jsonFiles);
        if (isVOC && jsonFiles.length > 0) {
            problems.push(`${where} holds both a "${LABELS_FOLDER_NAME}" folder and a .json file `
                + `(${ReviewFolderReader.listNames(jsonFiles)}). ${dropOnly(false)}`);
        } else if (!isVOC && jsonFiles.length === 0) {
            problems.push(`${where} has no .json file. ${DROP_BOTH}`);
        } else if (!isVOC && !jsonPair) {
            problems.push(`${where} holds ${jsonFiles.length} .json files `
                + `(${ReviewFolderReader.listNames(jsonFiles)}). Please drag and drop only one .json file with `
                + `the "${IMAGES_FOLDER_NAME}" folder.`);
        }
        const otherItems = unexpected.filter((child: FolderEntry) => !looseImages.includes(child));
        if (otherItems.length > 0) {
            problems.push(`${where} also holds ${ReviewFolderReader.listNames(otherItems)}, which do not `
                + `belong there. ${dropOnly(isVOC)}`);
        }

        let imageEntries: FolderEntry[] = [];
        if (imagesFolders.length === 1) {
            const entries = ReviewFolderReader.withoutIgnoredFiles(await imagesFolders[0].listChildren());
            const notImages = entries.filter((entry: FolderEntry) => !ReviewFolderReader.isImageEntry(entry));
            imageEntries = entries.filter((entry: FolderEntry) => ReviewFolderReader.isImageEntry(entry));

            if (notImages.length > 0) {
                problems.push(`The "${IMAGES_FOLDER_NAME}" folder also holds files that are not pictures `
                    + `(.jpg, .jpeg or .png): ${ReviewFolderReader.listNames(notImages)}. Please move them out of `
                    + 'it, then drag and drop again.');
            } else if (imageEntries.length === 0) {
                problems.push(`The "${IMAGES_FOLDER_NAME}" folder is empty: it has no picture.`);
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
                    + `but it also holds: ${ReviewFolderReader.listNames(notLabels)}. Please move them out of it, then `
                    + 'drag and drop again.');
            } else if (labelEntries.length === 0) {
                problems.push(`The "${loadedLabelsFolder.name}" folder has no .xml file.`);
            }
        }

        if (problems.length > 0) {
            throw new ReviewFolderError(problems);
        }

        const base: ReviewFolderBase = {
            // Named after the .json file or the labels folder when several items were dropped
            name: root.name || (isVOC ? loadedLabelsFolder.name : jsonPair.original.name.replace(/\.json$/i, '')),
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
