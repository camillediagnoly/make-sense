
import { ImageData, LabelName, LabelRect, TagConfig, TagName } from '../../../../store/labels/types';
import { AcceptedFileType } from '../../../../data/enums/AcceptedFileType';
import { v4 as uuidv4 } from 'uuid';
import { VOCImporter, PartialVOCImportError } from '../../../import/voc/VOCImporter';
import { isEqual } from 'lodash';
import { LabelsSelector } from '../../../../store/selectors/LabelsSelector';
import { LabelType } from '../../../../data/enums/LabelType';
import { FileUtil } from '../../../../utils/FileUtil';

const getDummyImageData = (fileName: string): ImageData => {
    return {
        id: uuidv4(),
        fileData: new File([''], fileName, { type: AcceptedFileType.IMAGE }),
        loadStatus: true,
        labelRects: [],
        labelPoints: [],
        labelLines: [],
        labelPolygons: [],
        labelNameIds: [],
        isVisitedByYOLOObjectDetector: false,
        isVisitedBySSDObjectDetector: false,
        isVisitedByPoseDetector: false,
        isVisitedByRoboflowAPI: false
    };
};

const getDummyFileData = (fileName: string): File => {
    return new File([''], fileName, { type: AcceptedFileType.TEXT });
};

class TestableVOCImporter extends VOCImporter {
    public static testableParseAnnotationsFromFileString(document: Document, labelNames: Record<string, LabelName>)
    :[LabelRect[], Record<string, LabelName>] {
        return TestableVOCImporter.parseAnnotationsFromFileString(document, labelNames);
    }
}

const parser = new DOMParser();
const validTestDocument = parser.parseFromString(
    `
    <annotation>
        <filename>test1.jpeg</filename>
        <path>\\some-test-path\\test1.jpeg</path>
        <size>
            <width>100</width>
            <height>200</height>
            <depth>3</depth>
        </size>
        <segmented>0</segmented>
        <object>
            <name>annotation1</name>
            <pose>Unspecified</pose>
            <truncated>0</truncated>
            <difficult>0</difficult>
            <bndbox>
                <xmin>10</xmin>
                <ymin>20</ymin>
                <xmax>30</xmax>
                <ymax>50</ymax>
            </bndbox>
        </object>
        <object>
            <name>annotation2</name>
            <pose>Unspecified</pose>
            <truncated>0</truncated>
            <difficult>0</difficult>
            <bndbox>
                <xmin>20</xmin>
                <ymin>30</ymin>
                <xmax>30</xmax>
                <ymax>50</ymax>
            </bndbox>
        </object>    
    </annotation>
    `,
    'application/xml'
);

describe('VOCImporter parseAnnotationsFromFileString method', () => {
    it('should return correctly for multiple annotations', () => {
        // given
        const emptyRecordSet: Record<string, LabelName> = {};

        // when
        const [annotations, newRecordSet] = TestableVOCImporter.testableParseAnnotationsFromFileString(validTestDocument, emptyRecordSet);

        // then
        expect(Object.keys(emptyRecordSet).length).toBe(0);
        expect(newRecordSet).toEqual(expect.objectContaining({
            'annotation1': expect.objectContaining({ name: 'annotation1'}),
            'annotation2': expect.objectContaining({ name: 'annotation2'}),
        }))
        expect(annotations).toEqual([
            expect.objectContaining({
                rect: {
                    x: 10,
                    y: 20,
                    height: 30,
                    width: 20
                },
                labelId: newRecordSet['annotation1'].id
            }),
            expect.objectContaining({
                rect: {
                    x: 20,
                    y: 30,
                    height: 20,
                    width: 10
                },
                labelId: newRecordSet['annotation2'].id
            })
        ]);
    });

    it('should reuse existing labels', () => {
        // given
        const existingRecordSet: Record<string, LabelName> = {
            'annotation2': {
                id: 'foobar',
                name: 'annotation2'
            }
        };

        // when
        const [annotations, newRecordSet] = TestableVOCImporter.testableParseAnnotationsFromFileString(validTestDocument, existingRecordSet);

        // then
        expect(Object.keys(existingRecordSet).length).toBe(1);
        expect(newRecordSet).toEqual(expect.objectContaining({
            'annotation1': expect.objectContaining({ name: 'annotation1' }),
            'annotation2': expect.objectContaining({ name: 'annotation2', id: 'foobar' }),
        }));
        expect(annotations.length).toBe(2);
        expect(annotations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                labelId: 'foobar'
            })
        ]));
    });
});

describe('VOCImporter import method', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should keep imported annotations and report files that could not be loaded', async () => {
        const importer = new VOCImporter([LabelType.RECT]);
        const imageData = getDummyImageData('test1.jpeg');
        const validFile = getDummyFileData('test1.xml');
        const brokenFile = getDummyFileData('broken.xml');

        jest.spyOn(LabelsSelector, 'getImagesData').mockReturnValue([imageData]);
        jest.spyOn(FileUtil, 'readFile').mockImplementation((fileData: File) => {
            if (fileData.name === validFile.name) {
                return Promise.resolve(`
                    <annotation>
                        <filename>test1.jpeg</filename>
                        <object>
                            <name>annotation1</name>
                            <bndbox>
                                <xmin>10</xmin>
                                <ymin>20</ymin>
                                <xmax>30</xmax>
                                <ymax>50</ymax>
                            </bndbox>
                        </object>
                    </annotation>
                `);
            }

            return Promise.reject(new Error('read failed'));
        });

        await new Promise<void>((resolve, reject) => {
            importer.import([validFile, brokenFile],
                () => reject(new Error('Expected a partial VOC import error.')),
                (error?: Error) => {
                    try {
                        expect(error).toBeInstanceOf(PartialVOCImportError);
                        expect((error as PartialVOCImportError).fileNames).toEqual(['broken.xml']);
                        expect((error as PartialVOCImportError).labelNames).toEqual([
                            expect.objectContaining({ name: 'annotation1' })
                        ]);
                        expect((error as PartialVOCImportError).imagesData[0].labelRects).toEqual([
                            expect.objectContaining({
                                rect: {
                                    x: 10,
                                    y: 20,
                                    height: 30,
                                    width: 20
                                }
                            })
                        ]);
                        resolve();
                    } catch (assertionError) {
                        reject(assertionError);
                    }
                });
        });
    });
});

describe('VOCImporter import method with tags', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const importFiles = (files: Record<string, string>, imagesData: ImageData[], currentTagConfig: TagConfig) => {
        jest.spyOn(LabelsSelector, 'getImagesData').mockReturnValue(imagesData);
        jest.spyOn(LabelsSelector, 'getTagConfig').mockReturnValue(currentTagConfig);
        jest.spyOn(FileUtil, 'readFile').mockImplementation((fileData: File) => Promise.resolve(files[fileData.name]));

        return new Promise<{imagesData: ImageData[], tagConfig: TagConfig}>((resolve, reject) => {
            new VOCImporter([LabelType.RECT]).import(
                Object.keys(files).map(getDummyFileData),
                (importedImagesData: ImageData[], labelNames: LabelName[], measurements, tagConfig: TagConfig) =>
                    resolve({imagesData: importedImagesData, tagConfig}),
                reject
            );
        });
    };

    const createFile = (fileName: string, tagsElement: string): string => `
        <annotation>
            <filename>${fileName}</filename>
            ${tagsElement}
            <object>
                <name>annotation1</name>
                <bndbox><xmin>10</xmin><ymin>20</ymin><xmax>30</xmax><ymax>50</ymax></bndbox>
            </object>
        </annotation>
    `;

    it('should restore the tags of each image and add the new ones to the project tags', async () => {
        // given
        const imagesData = [
            { ...getDummyImageData('a.jpg'), tags: ['Old'] },
            { ...getDummyImageData('b.jpg'), tags: ['Old'] },
            { ...getDummyImageData('c.jpg'), tags: ['Old'] }
        ];
        const files = {
            'a.xml': createFile('a.jpg', '<tags><tag group="Diagnostic">Patho</tag><tag>A&amp;B</tag></tags>'),
            'b.xml': createFile('b.jpg', '')
        };
        const currentTagConfig: TagConfig = { tags: [{ name: 'Old', color: '#current' }], groupNames: [] };

        // when
        const result = await importFiles(files, imagesData, currentTagConfig);

        // then
        expect(result.imagesData.map((imageData: ImageData) => imageData.tags)).toEqual([['Patho', 'A&B'], [], ['Old']]);
        expect(result.tagConfig.groupNames).toEqual(['Diagnostic']);
        expect(result.tagConfig.tags.map((tag: TagName) => [tag.name, tag.groupName, tag.color === '#current']))
            .toEqual([['Patho', 'Diagnostic', false], ['Old', undefined, true], ['A&B', undefined, false]]);
    });

    it('should give the tag config along with a partial import', async () => {
        // given
        jest.spyOn(LabelsSelector, 'getImagesData').mockReturnValue([getDummyImageData('a.jpg')]);
        jest.spyOn(LabelsSelector, 'getTagConfig').mockReturnValue({ tags: [], groupNames: [] });
        jest.spyOn(FileUtil, 'readFile').mockImplementation((fileData: File) =>
            fileData.name === 'a.xml'
                ? Promise.resolve(createFile('a.jpg', '<tags><tag>Patho</tag></tags>'))
                : Promise.reject(new Error('read failed')));

        // when
        const error = await new Promise<PartialVOCImportError>((resolve, reject) => {
            new VOCImporter([LabelType.RECT]).import(
                [getDummyFileData('a.xml'), getDummyFileData('broken.xml')],
                () => reject(new Error('Expected a partial VOC import error.')),
                (importError?: Error) => resolve(importError as PartialVOCImportError)
            );
        });

        // then
        expect(error.imagesData[0].tags).toEqual(['Patho']);
        expect(error.tagConfig.tags.map((tag: TagName) => tag.name)).toEqual(['Patho']);
    });
});
