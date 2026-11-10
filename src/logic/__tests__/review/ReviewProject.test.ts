import { ReviewProject } from '../../review/ReviewProject';
import { COCOReviewFolder, ReviewFolder, ReviewFolderError, ReviewFolderReader } from '../../review/ReviewFolderReader';
import { ImageData } from '../../../store/labels/types';
import { COCOObject } from '../../../data/labels/COCO';

const jsonFile = (name: string, content: unknown): File =>
    ({ name, text: async () => JSON.stringify(content) }) as unknown as File;

const imageFile = (name: string): File => new File(['image'], name, { type: 'image/png' });

const cocoObject = (): COCOObject => ({
    info: { description: 'test' },
    images: [
        { id: 1, width: 100, height: 80, file_name: 'a.png' },
        { id: 2, width: 100, height: 80, file_name: 'images/b.png' },
        { id: 3, width: 100, height: 80, file_name: 'not-in-folder.png' },
    ],
    categories: [
        { id: 1, name: 'q-head' },
        { id: 2, name: 'p-b.k:Surface-1' },
    ],
    annotations: [
        { id: 10, image_id: 1, category_id: 1, iscrowd: 0, bbox: [10, 20, 30, 40], area: 1200, segmentation: [] },
        { id: 11, image_id: 2, category_id: 2, iscrowd: 0, bbox: [0, 0, 2, 2], area: 4, segmentation: [[0, 0, 2, 0, 2, 2, 0, 2]] },
        { id: 12, image_id: 3, category_id: 1, iscrowd: 0, bbox: [1, 1, 1, 1], area: 1, segmentation: [] },
    ],
});

const folder = (content: unknown, imageNames: string[] = ['b.png', 'a.png']): ReviewFolder => ({
    name: 'study-1',
    format: 'coco',
    jsonFile: jsonFile('annotations.json', content),
    reviewedJsonName: 'annotations_reviewed.json',
    skippedJsonName: null,
    imageFiles: imageNames.map(imageFile),
});

describe('ReviewProject.load', () => {
    afterEach(() => ReviewProject.clear());

    it('makes rectangles of the "q" categories and polygons of the "p" categories', async () => {
        const result = await ReviewProject.load(folder(cocoObject()));

        const [imageA, imageB] = result.imagesData;
        expect(imageA.fileData.name).toBe('a.png');
        expect(imageA.labelRects.map((labelRect) => labelRect.rect)).toEqual([{ x: 10, y: 20, width: 30, height: 40 }]);
        expect(imageA.labelPolygons).toEqual([]);
        expect(imageB.labelRects).toEqual([]);
        expect(imageB.labelPolygons.map((labelPolygon) => labelPolygon.vertices)).toEqual([
            [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
        ]);
        expect(result.labelNames.map((labelName) => labelName.name)).toEqual(['q-head', 'p-b.k:Surface-1']);
        expect(result.missingImageNames).toEqual(['not-in-folder.png']);
    });

    it('rejects a category that starts neither with "q" nor with "p"', async () => {
        const content = cocoObject();
        content.categories[0].name = 'head';

        await expect(ReviewProject.load(folder(content))).rejects.toThrow(ReviewFolderError);
    });

    it('rejects a file that is not COCO', async () => {
        await expect(ReviewProject.load(folder({ images: [] }))).rejects.toThrow(/"annotations", "categories"/);
    });
});

describe('ReviewProject.buildReviewedCOCO', () => {
    afterEach(() => ReviewProject.clear());

    it('writes the original file back unchanged when nothing was moved', async () => {
        const result = await ReviewProject.load(folder(cocoObject()));

        expect(ReviewProject.buildReviewedCOCO(result.imagesData)).toEqual(cocoObject());
    });

    it('only rewrites the geometry of the moved annotations', async () => {
        const result = await ReviewProject.load(folder(cocoObject()));
        const [imageA, imageB] = result.imagesData;
        const moved: ImageData[] = [
            { ...imageA, labelRects: [{ ...imageA.labelRects[0], rect: { x: 11.111, y: 20, width: 30, height: 50 } }] },
            {
                ...imageB,
                labelPolygons: [{
                    ...imageB.labelPolygons[0],
                    vertices: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }],
                }],
            },
        ];

        const reviewed = ReviewProject.buildReviewedCOCO(moved);

        expect(reviewed.annotations[0]).toEqual({
            ...cocoObject().annotations[0], bbox: [11.11, 20, 30, 50], area: 1500,
        });
        expect(reviewed.annotations[1]).toEqual({
            ...cocoObject().annotations[1], bbox: [1, 1, 2, 2], area: 4, segmentation: [[1, 1, 3, 1, 3, 3, 1, 3]],
        });
        expect(reviewed.annotations[2]).toEqual(cocoObject().annotations[2]);
        expect(reviewed.images).toEqual(cocoObject().images);
    });

    it('names the output after the json file, with "_reviewed"', async () => {
        await ReviewProject.load(folder(cocoObject()));

        expect(ReviewProject.getReviewedJsonFileName()).toBe('annotations_reviewed.json');
    });
});

type FakeHandle = {
    kind: 'file' | 'directory';
    name: string;
    getFile?: () => Promise<File>;
    values?: () => AsyncIterable<FakeHandle>;
};

const fakeFile = (name: string): FakeHandle => ({ kind: 'file', name, getFile: async () => imageFile(name) });
const fakeDirectory = (name: string, children: FakeHandle[]): FakeHandle => ({
    kind: 'directory',
    name,
    values: async function* () {
        yield* children;
    },
});
const drop = (handle: FakeHandle) => ReviewFolderReader.readFromDroppedItems([
    { handle: Promise.resolve(handle as any), entry: null },
]) as Promise<COCOReviewFolder>;

describe('ReviewFolderReader.readFromDroppedItems', () => {
    it('reads a folder holding an images folder and one json file', async () => {
        const result = await drop(fakeDirectory('study-1', [
            fakeDirectory('images', [fakeFile('a.png'), fakeFile('b.JPG'), fakeFile('.DS_Store')]),
            fakeFile('annotations.json'),
            fakeFile('.DS_Store'),
        ]));

        expect(result.name).toBe('study-1');
        expect(result.jsonFile.name).toBe('annotations.json');
        expect(result.imageFiles.map((file) => file.name)).toEqual(['a.png', 'b.JPG']);
    });

    it.each([
        ['no images folder', [fakeFile('annotations.json')], /has no "images" folder/],
        ['no json file', [fakeDirectory('images', [fakeFile('a.png')])], /has no annotations/],
        ['two json files', [fakeDirectory('images', [fakeFile('a.png')]), fakeFile('a.json'), fakeFile('b.json')], /2 \.json files/],
        ['another file', [fakeDirectory('images', [fakeFile('a.png')]), fakeFile('a.json'), fakeFile('notes.txt')], /also holds: "notes.txt"/],
        ['an empty images folder', [fakeDirectory('images', []), fakeFile('a.json')], /has no image/],
        ['a non image in images', [fakeDirectory('images', [fakeFile('a.png'), fakeFile('a.txt')]), fakeFile('a.json')], /only hold .jpg/],
    ])('rejects a folder with %s', async (_, children, message) => {
        await expect(drop(fakeDirectory('study-1', children))).rejects.toThrow(message);
    });

    it('loads <name>_reviewed.json when the folder was already exported', async () => {
        const result = await drop(fakeDirectory('study-1', [
            fakeDirectory('images', [fakeFile('a.png')]),
            fakeFile('annotations_reviewed.json'),
            fakeFile('annotations.json'),
        ]));

        expect(result.jsonFile.name).toBe('annotations_reviewed.json');
        expect(result.reviewedJsonName).toBe('annotations_reviewed.json');
        expect(result.skippedJsonName).toBe('annotations.json');
    });

    it('writes next to a lone json file, with "_reviewed"', async () => {
        const result = await drop(fakeDirectory('study-1', [
            fakeDirectory('images', [fakeFile('a.png')]),
            fakeFile('annotations.json'),
        ]));

        expect(result.jsonFile.name).toBe('annotations.json');
        expect(result.reviewedJsonName).toBe('annotations_reviewed.json');
        expect(result.skippedJsonName).toBeNull();
    });

    it('rejects two json files that are not a json and its reviewed version', async () => {
        await expect(drop(fakeDirectory('study-1', [
            fakeDirectory('images', [fakeFile('a.png')]),
            fakeFile('a.json'),
            fakeFile('b_reviewed.json'),
        ]))).rejects.toThrow(/2 \.json files/);
    });

    it('rejects a dropped file', async () => {
        await expect(drop(fakeFile('annotations.json'))).rejects.toThrow(/A file was dropped/);
    });

    it('rejects several dropped items', async () => {
        await expect(ReviewFolderReader.readFromDroppedItems([
            { handle: null, entry: null }, { handle: null, entry: null },
        ])).rejects.toThrow(/2 items were dropped/);
    });
});

describe('ReviewProject deleted annotations', () => {
    afterEach(() => ReviewProject.clear());

    const deleteAll = (imagesData: ImageData[]): ImageData[] => imagesData.map((imageData: ImageData) => ({
        ...imageData,
        labelRects: imageData.labelRects.map((labelRect) => ({ ...labelRect, isDeleted: true })),
        labelPolygons: imageData.labelPolygons.map((labelPolygon) => ({ ...labelPolygon, isDeleted: true })),
    }));

    it('exports a deleted annotation with a "_deleted" category, created only when needed', async () => {
        const result = await ReviewProject.load(folder(cocoObject()));
        const [imageA, imageB] = result.imagesData;

        const reviewed = ReviewProject.buildReviewedCOCO([deleteAll([imageA])[0], imageB]);

        expect(reviewed.categories).toEqual([...cocoObject().categories, { id: 3, name: 'q-head_deleted' }]);
        expect(reviewed.annotations[0]).toEqual({ ...cocoObject().annotations[0], category_id: 3 });
        expect(reviewed.annotations[1]).toEqual(cocoObject().annotations[1]);
    });

    it('loads "_deleted" annotations as deleted, and writes them back to their category when re-added', async () => {
        const content = cocoObject();
        content.categories = [
            { id: 1, name: 'q-head_deleted' },
            { id: 2, name: 'p-b.k:Surface-1' },
            { id: 5, name: 'p-b.k:Surface-1_deleted' },
        ];
        content.annotations[1].category_id = 5;
        const result = await ReviewProject.load(folder(content));
        const [imageA, imageB] = result.imagesData;

        expect(result.labelNames.map((labelName) => labelName.name)).toEqual(['q-head', 'p-b.k:Surface-1']);
        expect(imageA.labelRects[0].isDeleted).toBe(true);
        expect(imageB.labelPolygons[0].isDeleted).toBe(true);
        expect(ReviewProject.buildReviewedCOCO(result.imagesData)).toEqual(content);

        const readded = ReviewProject.buildReviewedCOCO([
            { ...imageA, labelRects: [{ ...imageA.labelRects[0], isDeleted: false }] },
            { ...imageB, labelPolygons: [{ ...imageB.labelPolygons[0], isDeleted: false }] },
        ]);

        // q-head had no category of its own yet: it is added, p-b.k:Surface-1 reuses id 2
        expect(readded.categories).toEqual([...content.categories, { id: 6, name: 'q-head' }]);
        expect(readded.annotations[0].category_id).toBe(6);
        expect(readded.annotations[1].category_id).toBe(2);
    });
});

describe('ReviewProject.exportReviewedFolder', () => {
    afterEach(() => ReviewProject.clear());

    it('writes <name>_reviewed.json in the input folder', async () => {
        const written: Record<string, unknown> = {};
        const directoryHandle: any = {
            kind: 'directory',
            name: 'study-1',
            queryPermission: async () => 'granted',
            getFileHandle: async (name: string) => ({
                createWritable: async () => ({
                    write: async (data: unknown) => { written[name] = data; },
                    close: async () => undefined,
                }),
            }),
        };
        const result = await ReviewProject.load({ ...folder(cocoObject()), directoryHandle });

        expect(await ReviewProject.exportReviewedFolder(result.imagesData)).toEqual({
            kind: 'folder', folderName: 'study-1', fileName: 'annotations_reviewed.json',
        });
        expect(Object.keys(written)).toEqual(['annotations_reviewed.json']);
        expect(JSON.parse(written['annotations_reviewed.json'] as string)).toEqual(cocoObject());
    });

    it('fails when the browser does not allow writing in the folder', async () => {
        const directoryHandle: any = {
            kind: 'directory',
            name: 'study-1',
            queryPermission: async () => 'prompt',
            requestPermission: async () => 'denied',
            getFileHandle: jest.fn(),
        };
        const result = await ReviewProject.load({ ...folder(cocoObject()), directoryHandle });

        await expect(ReviewProject.exportReviewedFolder(result.imagesData)).rejects.toThrow(/not allowed/);
        expect(directoryHandle.getFileHandle).not.toHaveBeenCalled();
    });
});
