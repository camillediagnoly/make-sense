import { ReviewProject } from '../../review/ReviewProject';
import { ReviewFolderError, ReviewFolderReader, VOCReviewFolder } from '../../review/ReviewFolderReader';
import { ImageData } from '../../../store/labels/types';
import { ReviewVOC } from '../../review/ReviewVOC';

const textFile = (name: string, text: string): File => ({ name, text: async () => text }) as unknown as File;
const imageFile = (name: string): File => new File(['image'], name, { type: 'image/jpeg' });

const object = (name: string, [xmin, ymin, xmax, ymax]: number[]) => `
	<object>
		<name>${name}</name>
		<pose>Unspecified</pose>
		<bndbox>
			<xmin>${xmin}</xmin>
			<ymin>${ymin}</ymin>
			<xmax>${xmax}</xmax>
			<ymax>${ymax}</ymax>
		</bndbox>
	</object>`;

const voc = (fileName: string, objects: string) => `<annotation>
	<folder>review</folder>
	<filename>${fileName}</filename>
	<size>
		<width>640</width>
		<height>480</height>
		<depth>3</depth>
	</size>
	<tags>
		<tag group="Case">Physio</tag>
	</tags>${objects}
</annotation>
`;

const A_XML = voc('a.jpg', object('D.PA', [10, 20, 40, 60]) + object('D.SVC_deleted', [1, 2, 3, 4]));
// Matched by the stem of the .xml file: its <filename> is not in the images folder
const B_XML = voc('renamed.jpg', object('D.PA', [5, 5, 15, 15]));
const ORPHAN_XML = voc('orphan.jpg', object('D.PA', [0, 0, 1, 1]));

const folder = (
    labelFiles: File[] = [textFile('a.xml', A_XML), textFile('b.xml', B_XML), textFile('orphan.xml', ORPHAN_XML)],
    imageNames: string[] = ['b.jpg', 'a.jpg', 'c.jpg']
): VOCReviewFolder => ({
    name: 'update_testset',
    format: 'voc',
    labelFiles,
    labelsFolderName: 'labels',
    reviewedLabelsFolderName: 'labels_reviewed',
    skippedLabelsFolderName: null,
    imageFiles: imageNames.map(imageFile),
});

const exportFiles = async (imagesData: ImageData[]): Promise<Record<string, string>> => {
    const written: Record<string, string> = {};
    const labelsHandle = {
        getFileHandle: async (name: string) => ({
            createWritable: async () => ({
                write: async (data: string) => { written[name] = data; },
                close: async () => undefined,
            }),
        }),
    };
    const directoryHandle = {
        kind: 'directory', name: 'update_testset',
        queryPermission: async () => 'granted',
        getDirectoryHandle: jest.fn(async () => labelsHandle),
    };
    (ReviewProject as any).folder.directoryHandle = directoryHandle;
    const result = await ReviewProject.exportReviewedFolder(imagesData);
    expect(directoryHandle.getDirectoryHandle).toHaveBeenCalledWith('labels_reviewed', { create: true });
    expect(result).toEqual({ kind: 'folder', folderName: 'update_testset', fileName: 'labels_reviewed/', fileCount: 3 });
    return written;
};

describe('ReviewProject with a labels folder of .xml files', () => {
    afterEach(() => ReviewProject.clear());

    it('loads every <object> as a rectangle, "_deleted" ones as deleted', async () => {
        const result = await ReviewProject.load(folder());

        const [imageA, imageB, imageC] = result.imagesData;
        expect(imageA.fileData.name).toBe('a.jpg');
        expect(imageA.imgWidth).toBe(640);
        expect(imageA.labelRects.map((labelRect) => [labelRect.rect, !!labelRect.isDeleted])).toEqual([
            [{ x: 10, y: 20, width: 30, height: 40 }, false],
            [{ x: 1, y: 2, width: 2, height: 2 }, true],
        ]);
        expect(imageB.labelRects.map((labelRect) => labelRect.rect)).toEqual([{ x: 5, y: 5, width: 10, height: 10 }]);
        expect(imageC.labelRects).toEqual([]);
        expect(result.labelNames.map((labelName) => labelName.name)).toEqual(['D.PA', 'D.SVC']);
        expect(result.missingImageNames).toEqual(['orphan.xml']);
        expect(result.imagesWithoutAnnotations).toEqual(['c.jpg']);
    });

    it('writes back unchanged files exactly as they were read', async () => {
        const result = await ReviewProject.load(folder());

        expect(await exportFiles(result.imagesData)).toEqual({ 'a.xml': A_XML, 'b.xml': B_XML, 'orphan.xml': ORPHAN_XML });
    });

    it('writes the moved boxes and renames the deleted and re-added objects, keeping the rest', async () => {
        const result = await ReviewProject.load(folder());
        const [imageA, imageB, imageC] = result.imagesData;
        const [moved, deleted] = imageA.labelRects;
        const edited: ImageData = {
            ...imageA,
            labelRects: [
                { ...moved, rect: { x: 11.4, y: 20, width: 30, height: 40.6 }, isDeleted: true },
                { ...deleted, isDeleted: false },
            ],
        };

        const written = await exportFiles([edited, imageB, imageC]);

        expect(written['b.xml']).toBe(B_XML);
        expect(written['a.xml']).toBe(voc('a.jpg',
            object('D.PA_deleted', [11, 20, 41, 61]) + object('D.SVC', [1, 2, 3, 4])));
    });

    it('keeps the <?xml?> declaration of a rewritten file', async () => {
        const text = `<?xml version="1.0" encoding="utf-8"?>\n${voc('a.jpg', object('D.PA', [1, 1, 2, 2]))}`;
        const result = await ReviewProject.load(folder([textFile('a.xml', text)], ['a.jpg']));
        const [imageA] = result.imagesData;

        const files = ReviewVOC.buildReviewedFiles(
            (ReviewProject as any).vocLabelFiles,
            [{ ...imageA, labelRects: [{ ...imageA.labelRects[0], isDeleted: true }] }]
        );
        expect(files[0].content.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<annotation>')).toBe(true);
        expect(files[0].content).toContain('<name>D.PA_deleted</name>');
    });

    it.each([
        ['an invalid xml', [textFile('a.xml', '<annotation><object>')], /"labels\/a.xml" is not a valid Pascal VOC/],
        ['an object without box', [textFile('a.xml', voc('a.jpg', '<object><name>D.PA</name></object>'))],
            /the object "D.PA" has no valid <bndbox>/],
        ['two files for one image', [textFile('a.xml', A_XML), textFile('copy.xml', A_XML)],
            /"labels\/a.xml" and "labels\/copy.xml" both describe the image "a.jpg"/],
    ])('rejects %s', async (_, labelFiles, message) => {
        const load = ReviewProject.load(folder(labelFiles, ['a.jpg']));
        await expect(load).rejects.toThrow(ReviewFolderError);
        await expect(ReviewProject.load(folder(labelFiles, ['a.jpg']))).rejects.toThrow(message);
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
]) as Promise<VOCReviewFolder>;

describe('ReviewFolderReader with a labels folder', () => {
    it('reads a folder holding an images folder and a labels folder', async () => {
        const result = await drop(fakeDirectory('update_testset', [
            fakeDirectory('images', [fakeFile('a.jpg')]),
            fakeDirectory('labels', [fakeFile('a.xml'), fakeFile('.DS_Store')]),
        ]));

        expect(result.format).toBe('voc');
        expect(result.labelFiles.map((file) => file.name)).toEqual(['a.xml']);
        expect(result.labelsFolderName).toBe('labels');
        expect(result.reviewedLabelsFolderName).toBe('labels_reviewed');
        expect(result.skippedLabelsFolderName).toBeNull();
    });

    it('loads labels_reviewed when the folder was already exported', async () => {
        const result = await drop(fakeDirectory('update_testset', [
            fakeDirectory('images', [fakeFile('a.jpg')]),
            fakeDirectory('labels', [fakeFile('a.xml')]),
            fakeDirectory('labels_reviewed', [fakeFile('a.xml')]),
        ]));

        expect(result.labelsFolderName).toBe('labels_reviewed');
        expect(result.skippedLabelsFolderName).toBe('labels');
    });

    it.each([
        ['both a labels folder and a json file',
            [fakeDirectory('images', [fakeFile('a.jpg')]), fakeDirectory('labels', [fakeFile('a.xml')]), fakeFile('a.json')],
            /holds both a "labels" folder and .json annotations/],
        ['a non xml file in labels',
            [fakeDirectory('images', [fakeFile('a.jpg')]), fakeDirectory('labels', [fakeFile('a.xml'), fakeFile('a.txt')])],
            /"labels" folder must only hold .xml files, but it also holds: "a.txt"/],
        ['an empty labels folder',
            [fakeDirectory('images', [fakeFile('a.jpg')]), fakeDirectory('labels', [])],
            /"labels" folder has no .xml file/],
        ['another folder',
            [fakeDirectory('images', [fakeFile('a.jpg')]), fakeDirectory('labels', [fakeFile('a.xml')]), fakeDirectory('masks', [])],
            /only hold the "images" folder and the "labels" folder, but it also holds: "masks\/"/],
    ])('rejects a folder with %s', async (_, children, message) => {
        await expect(drop(fakeDirectory('update_testset', children))).rejects.toThrow(message);
    });
});
