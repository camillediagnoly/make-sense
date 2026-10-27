import { COCOImporter } from '../../../import/coco/COCOImporter';
import { COCOExporter } from '../../../export/polygon/COCOExporter';
import { COCOImage, COCOObject } from '../../../../data/labels/COCO';
import { LabelType } from '../../../../data/enums/LabelType';
import { ImageData, LabelName, TagName } from '../../../../store/labels/types';
import { TagUtil } from '../../../../utils/TagUtil';
import { Settings } from '../../../../settings/Settings';

// The measurement config read by the exporter comes from the store
jest.mock('../../../../index', () => ({
    store: {
        getState: () => ({ general: { measurementFunctionByName: {} } })
    }
}));

const createImageData = (id: string, fileName: string, tags?: string[]): ImageData => ({
    id,
    fileData: new File([''], fileName, { type: 'image/jpeg' }),
    loadStatus: false,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [{
        id: `${id}-polygon`,
        labelId: 'label-id',
        isVisible: true,
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    }],
    labelNameIds: [],
    tags,
    imgWidth: 100,
    imgHeight: 50,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const createCOCOImage = (id: number, fileName: string, tags?: string[]): COCOImage => ({
    id,
    width: 100,
    height: 50,
    file_name: fileName,
    ...(tags ? { tags } : {})
});

const createCOCOObject = (images: COCOImage[], tagNames?: string[]): COCOObject => ({
    info: { description: 'project' },
    images,
    annotations: images.map((image: COCOImage, index: number) => ({
        id: index,
        iscrowd: 0,
        image_id: image.id,
        category_id: 1,
        segmentation: [[0, 0, 10, 0, 10, 10]],
        bbox: [0, 0, 10, 10],
        area: 50
    })),
    categories: [{ id: 1, name: 'label_1' }],
    ...(tagNames ? { tag_names: tagNames } : {})
});

const labelNames: LabelName[] = [{ id: 'label-id', name: 'label_1' }];

const getTags = (imagesData: ImageData[]): string[][] =>
    imagesData.map((imageData: ImageData) => imageData.tags);

describe('COCOImporter applyLabels method with tags', () => {
    const importer = new COCOImporter([LabelType.POLYGON]);

    it('should restore the tags of each image by file name', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg'), createImageData('image-b', 'b.jpg')];
        const cocoObject = createCOCOObject([
            createCOCOImage(1, 'b.jpg', ['TGA']),
            createCOCOImage(2, 'a.jpg', ['Patho', 'TGA'])
        ], ['Physio', 'Patho', 'TGA']);

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(getTags(result.imagesData)).toEqual([['Patho', 'TGA'], ['TGA']]);
        expect(TagUtil.getTagNames(result.tagConfig)).toEqual(['Physio', 'Patho', 'TGA']);
    });

    it('should add the tags only found on images to the tag list', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject = createCOCOObject([createCOCOImage(1, 'a.jpg', ['TGA', 'Physio'])], ['Physio']);

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(TagUtil.getTagNames(result.tagConfig)).toEqual(['Physio', 'TGA']);
    });

    it('should replace the tags the images held before the import', () => {
        // given
        const imagesData = [
            createImageData('image-a', 'a.jpg', ['Old']),
            createImageData('image-b', 'missing.jpg', ['Old'])
        ];
        const cocoObject = createCOCOObject([createCOCOImage(1, 'a.jpg')]);

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(getTags(result.imagesData)).toEqual([[], []]);
        expect(TagUtil.getTagNames(result.tagConfig)).toEqual([]);
    });

    it('should ignore malformed tags', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject: COCOObject = {
            ...createCOCOObject([
                createCOCOImage(1, 'a.jpg', [' Patho ', '', 3, 'Patho'] as unknown as string[])
            ]),
            tag_names: 'Patho' as unknown as string[]
        };

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(getTags(result.imagesData)).toEqual([['Patho']]);
        expect(TagUtil.getTagNames(result.tagConfig)).toEqual(['Patho']);
    });

    it('should get back the exported tags and tag list', () => {
        // given
        const imagesData = [
            createImageData('image-a', 'a.jpg', ['TGA']),
            createImageData('image-b', 'b.jpg', ['Physio', 'TGA'])
        ];
        const exportedFile = JSON.stringify(COCOExporter.mapImagesDataToCOCOObject(
            imagesData,
            labelNames,
            'project',
            {
                tags: [
                    { name: 'Physio', color: '#000000', groupName: 'Diagnostic' },
                    { name: 'TGA', color: '#000000' },
                    { name: 'Unused', color: '#000000' }
                ],
                groupNames: ['Diagnostic', 'Empty']
            }
        ));

        // when
        const result = importer.applyLabels(
            imagesData.map((imageData: ImageData) => ({ ...imageData, tags: [] })),
            COCOImporter.deserialize(exportedFile)
        );

        // then
        expect(getTags(result.imagesData)).toEqual([['TGA'], ['Physio', 'TGA']]);
        expect(TagUtil.getTagNames(result.tagConfig)).toEqual(['Physio', 'TGA', 'Unused']);
        expect(result.tagConfig.groupNames).toEqual(['Diagnostic', 'Empty']);
        expect(result.tagConfig.tags.map((tag: TagName) => tag.groupName)).toEqual(['Diagnostic', undefined, undefined]);
        expect(result.imagesData.map((imageData: ImageData) => imageData.labelPolygons.length)).toEqual([1, 1]);
    });
});

describe('COCOImporter applyLabels method with tag groups', () => {
    const importer = new COCOImporter([LabelType.POLYGON]);

    it('should sort the tags group by group, the ones without group last', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject: COCOObject = {
            ...createCOCOObject([createCOCOImage(1, 'a.jpg', ['TGA'])], ['Doute', 'Physio', 'TGA', 'Patho']),
            tag_groups: [
                { name: 'Diagnostic', tags: ['Physio', 'Patho'] },
                { name: 'Cardiopathies', tags: ['TGA'] }
            ]
        };

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(result.tagConfig.groupNames).toEqual(['Diagnostic', 'Cardiopathies']);
        expect(result.tagConfig.tags.map((tag: TagName) => [tag.name, tag.groupName])).toEqual([
            ['Physio', 'Diagnostic'],
            ['Patho', 'Diagnostic'],
            ['TGA', 'Cardiopathies'],
            ['Doute', undefined]
        ]);
    });

    it('should give the tags the label palette colors in their order, like the label names', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject: COCOObject = {
            ...createCOCOObject([createCOCOImage(1, 'a.jpg')], ['Doute', 'Physio']),
            tag_groups: [{ name: 'Diagnostic', tags: ['Physio'] }]
        };

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(result.tagConfig.tags.map((tag: TagName) => tag.color)).toEqual([
            Settings.LABEL_COLORS_PALETTE[0],
            Settings.LABEL_COLORS_PALETTE[1]
        ]);
    });

    it('should keep a tag in its first group and add the tags only listed in a group', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject: COCOObject = {
            ...createCOCOObject([createCOCOImage(1, 'a.jpg')], ['Physio']),
            tag_groups: [
                { name: 'Diagnostic', tags: ['Physio', 'Patho'] },
                { name: 'Other', tags: ['Physio'] },
                { name: 'Diagnostic', tags: ['TGA'] }
            ]
        };

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(result.tagConfig.groupNames).toEqual(['Diagnostic', 'Other']);
        expect(result.tagConfig.tags.map((tag: TagName) => [tag.name, tag.groupName])).toEqual([
            ['Physio', 'Diagnostic'],
            ['Patho', 'Diagnostic'],
            ['TGA', 'Diagnostic']
        ]);
    });

    it('should ignore malformed tag groups', () => {
        // given
        const imagesData = [createImageData('image-a', 'a.jpg')];
        const cocoObject: COCOObject = {
            ...createCOCOObject([createCOCOImage(1, 'a.jpg')], ['Physio']),
            tag_groups: [null, 'Diagnostic', { name: '  ', tags: ['Physio'] }, { name: 'Valid', tags: 'Physio' }] as unknown as COCOObject['tag_groups']
        };

        // when
        const result = importer.applyLabels(imagesData, cocoObject);

        // then
        expect(result.tagConfig.groupNames).toEqual(['Valid']);
        expect(result.tagConfig.tags.map((tag: TagName) => [tag.name, tag.groupName])).toEqual([['Physio', undefined]]);
    });
});
