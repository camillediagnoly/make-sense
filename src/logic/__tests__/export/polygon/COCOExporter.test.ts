
import { COCOAnnotation, COCOCategory, COCOInfo } from "../../../../data/labels/COCO";
import { COCOExporter } from "../../../export/polygon/COCOExporter";
import { ImageData, LabelName, TagConfig, TagName } from "../../../../store/labels/types";

// The measurement config reads the store
jest.mock('../../../../index', () => ({
    store: {
        getState: () => ({ general: { measurementFunctionByName: {} } })
    }
}));

const createImageData = (id: string, tags?: string[], hasPolygon = true): ImageData => ({
    id,
    fileData: new File([''], `${id}.jpg`, { type: 'image/jpeg' }),
    loadStatus: false,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: hasPolygon ? [{
        id: `${id}-polygon`,
        labelId: 'id_1',
        isVisible: true,
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    }] : [],
    labelNameIds: [],
    tags,
    imgWidth: 100,
    imgHeight: 50,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

// Tags without group, unless a group is given as "Group/Tag"
const createTagConfig = (tagNames: string[], groupNames: string[] = []): TagConfig => ({
    tags: tagNames.map((tagName: string): TagName => {
        const [groupName, name] = tagName.includes('/') ? tagName.split('/') : [undefined, tagName];
        return { name, color: '#ff3838', ...(groupName ? { groupName } : {}) };
    }),
    groupNames
});

const labelNames: LabelName[] = [
    {
        "id": "id_1",
        "name": "label_1"
    }
];

describe('COCOExporter produces correct COCO label', () => {
    it('should produce correct info component', () => {
        const givenDescription = "lorem ipsum";
        const expectedCOCOInfo: COCOInfo = {
            "description": "lorem ipsum"
        };
        expect(COCOExporter.getInfoComponent(givenDescription)).toEqual(expectedCOCOInfo);
    });

    it('should produce correct categories component', () => {
        const givenLabelNames: LabelName[] = [
            {
                "id": "id_1",
                "name": "label_1"
            },
            {
                "id": "id_2",
                "name": "label_2"
            },
            {
                "id": "id_3",
                "name": "label_3"
            }
        ];
        const expectedCOCOCategories: COCOCategory[] = [
            {
                "id": 1,
                "name": "label_1"
            },
            {
                "id": 2,
                "name": "label_2"
            },
            {
                "id": 3,
                "name": "label_3"
            }
        ];
        expect(COCOExporter.getCategoriesComponent(givenLabelNames)).toEqual(expectedCOCOCategories);
    });
});

describe('COCOExporter mapImagesDataToCOCOObject method with tags', () => {
    it('should not add any tag key to a project without tags', () => {
        // when
        const cocoObject = COCOExporter.mapImagesDataToCOCOObject(
            [createImageData('image-0')],
            labelNames,
            'project'
        );

        // then
        expect(Object.keys(cocoObject)).toEqual(['info', 'images', 'annotations', 'categories']);
        expect(Object.keys(cocoObject.images[0])).toEqual(['id', 'width', 'height', 'file_name']);
    });

    it('should export the tags of each image after its file name, in the tag list order', () => {
        // when
        const cocoObject = COCOExporter.mapImagesDataToCOCOObject(
            [createImageData('image-0', ['TGA', 'Patho']), createImageData('image-1')],
            labelNames,
            'project',
            createTagConfig(['Physio', 'Patho', 'TGA'])
        );

        // then
        expect(cocoObject.images).toEqual([
            { "id": 1, "width": 100, "height": 50, "file_name": "image-0.jpg", "tags": ["Patho", "TGA"] },
            { "id": 2, "width": 100, "height": 50, "file_name": "image-1.jpg" }
        ]);
        expect(Object.keys(cocoObject.images[0])).toEqual(['id', 'width', 'height', 'file_name', 'tags']);
        expect(cocoObject.tag_names).toEqual(['Physio', 'Patho', 'TGA']);
        expect(Object.keys(cocoObject)).toEqual(['info', 'images', 'annotations', 'categories', 'tag_names']);
    });

    it('should not export the tags missing from the tag list', () => {
        const cocoObject = COCOExporter.mapImagesDataToCOCOObject(
            [createImageData('image-0', ['Removed'])],
            labelNames,
            'project',
            createTagConfig(['Physio'])
        );

        expect(cocoObject.images[0].tags).toBeUndefined();
    });

    it('should leave out the images without polygons, together with their tags', () => {
        // when
        const cocoObject = COCOExporter.mapImagesDataToCOCOObject(
            [createImageData('image-0', ['Patho'], false), createImageData('image-1', ['TGA'])],
            labelNames,
            'project',
            createTagConfig(['Patho', 'TGA'])
        );

        // then
        expect(cocoObject.images).toEqual([
            { "id": 1, "width": 100, "height": 50, "file_name": "image-1.jpg", "tags": ["TGA"] }
        ]);
        expect(cocoObject.annotations.map((annotation: COCOAnnotation) => annotation.image_id)).toEqual([1]);
    });

    it('should export the tag groups, without the tag colors', () => {
        // when
        const cocoObject = COCOExporter.mapImagesDataToCOCOObject(
            [createImageData('image-0', ['TGA'])],
            labelNames,
            'project',
            createTagConfig(
                ['Diagnostic/Physio', 'Diagnostic/Patho', 'Cardiopathies/TGA', 'Doute'],
                ['Diagnostic', 'Cardiopathies', 'Empty']
            )
        );

        // then
        expect(cocoObject.tag_names).toEqual(['Physio', 'Patho', 'TGA', 'Doute']);
        expect(cocoObject.tag_groups).toEqual([
            { "name": "Diagnostic", "tags": ["Physio", "Patho"] },
            { "name": "Cardiopathies", "tags": ["TGA"] },
            { "name": "Empty", "tags": [] }
        ]);
        expect(Object.keys(cocoObject)).toEqual(['info', 'images', 'annotations', 'categories', 'tag_names', 'tag_groups']);
    });
});