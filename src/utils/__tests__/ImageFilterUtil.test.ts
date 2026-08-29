import { ImageFilterMode } from '../../data/enums/ImageFilterMode';
import { ImageSortMode } from '../../data/enums/ImageSortMode';
import { LabelType } from '../../data/enums/LabelType';
import { LabelStatus } from '../../data/enums/LabelStatus';
import { ImageClassCriteria } from '../../store/general/types';
import { ImageData } from '../../store/labels/types';
import { ImageFilterUtil } from '../ImageFilterUtil';
import { ImageGroupUtil } from '../ImageGroupUtil';

const createImageData = (
    id: string,
    labelIds: string[],
    groupName?: string,
    lastModified?: number
): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png', lastModified }),
    groupName,
    loadStatus: true,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: labelIds,
    imgWidth: 640,
    imgHeight: 480,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const getFilteredIndices = (
    imagesData: ImageData[],
    criteria: ImageClassCriteria[]
): number[] =>
    ImageFilterUtil.getFilteredImageIndices(
        imagesData,
        LabelType.RECT,
        ImageFilterMode.ALL,
        '',
        criteria
    );

describe('ImageFilterUtil image list status filters', () => {
    it('should optionally keep labeled images visible in Unlabeled', () => {
        const images = [
            createImageData('image-0', []),
            {
                ...createImageData('image-1', []),
                labelRects: [{
                    id: 'rect-0',
                    labelId: 'A',
                    isVisible: true,
                    rect: {
                        x: 0,
                        y: 0,
                        width: 10,
                        height: 10,
                    },
                    isCreatedByAI: false,
                    status: LabelStatus.ACCEPTED,
                    suggestedLabel: null,
                }],
            },
            createImageData('image-2', []),
        ];

        expect(ImageFilterUtil.getFilteredImageIndices(
            images,
            LabelType.RECT,
            ImageFilterMode.UNLABELED,
            '',
            []
        )).toEqual([0, 2]);

        expect(ImageFilterUtil.getFilteredImageIndices(
            images,
            LabelType.RECT,
            ImageFilterMode.UNLABELED,
            '',
            [],
            true,
            ['image-0', 'image-1']
        )).toEqual([0, 1]);
    });
});

describe('ImageFilterUtil image class criteria expression support', () => {
    it('should filter by imported image groups', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['A'], 'review_batch'),
            createImageData('image-2', ['B'], 'review_batch'),
        ];

        const criteria: ImageClassCriteria[] = [
            { type: 'label', labelId: ImageGroupUtil.getGroupFilterTokenId('review_batch') },
            { type: 'operator', operator: 'AND' },
            { type: 'label', labelId: 'A' },
        ];

        expect(getFilteredIndices(images, criteria)).toEqual([1]);
    });

    it('should evaluate expressions with AND, OR and NOT', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['A', 'B']),
            createImageData('image-2', ['B', 'C']),
        ];

        const criteria: ImageClassCriteria[] = [
            { type: 'label', labelId: 'A' },
            { type: 'operator', operator: 'AND' },
            { type: 'operator', operator: 'NOT' },
            { type: 'label', labelId: 'B' },
            { type: 'operator', operator: 'OR' },
            { type: 'label', labelId: 'C' },
        ];

        expect(getFilteredIndices(images, criteria)).toEqual([0, 2]);
    });

    it('should respect parentheses precedence', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['A', 'B']),
            createImageData('image-2', ['A', 'C']),
            createImageData('image-3', ['B', 'C']),
        ];

        const criteria: ImageClassCriteria[] = [
            { type: 'label', labelId: 'A' },
            { type: 'operator', operator: 'AND' },
            { type: 'parenthesis', value: '(' },
            { type: 'label', labelId: 'B' },
            { type: 'operator', operator: 'OR' },
            { type: 'label', labelId: 'C' },
            { type: 'parenthesis', value: ')' },
        ];

        expect(getFilteredIndices(images, criteria)).toEqual([1, 2]);
    });

    it('should support excluding other classes without counting image groups as classes', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['A', 'B']),
            createImageData('image-2', ['A'], 'review_batch'),
            createImageData('image-3', ['B']),
        ];

        expect(getFilteredIndices(images, [{ type: 'label', labelId: 'A' }]))
            .toEqual([0, 1, 2]);
        expect(getFilteredIndices(images, [
            { type: 'label', labelId: 'A' },
            { type: 'operator', operator: 'AND' },
            { type: 'operator', operator: 'NOT' },
            { type: 'otherLabels' },
        ])).toEqual([0, 2]);
    });

    it('should keep all images when expression is invalid', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['B']),
        ];

        const invalidCriteria: ImageClassCriteria[] = [
            { type: 'label', labelId: 'A' },
            { type: 'operator', operator: 'AND' },
        ];

        expect(ImageFilterUtil.isImageClassCriteriaValid(invalidCriteria)).toBe(false);
        expect(getFilteredIndices(images, invalidCriteria)).toEqual([0, 1]);
    });

    it('should preserve legacy left-to-right criteria semantics', () => {
        const images = [
            createImageData('image-0', ['A']),
            createImageData('image-1', ['B', 'C']),
            createImageData('image-2', ['A', 'C']),
            createImageData('image-3', ['B']),
        ];

        const legacyCriteria: ImageClassCriteria[] = [
            { labelId: 'A', mode: 'include', operator: 'and' },
            { labelId: 'B', mode: 'include', operator: 'or' },
            { labelId: 'C', mode: 'include', operator: 'and' },
        ];

        expect(ImageFilterUtil.isImageClassCriteriaValid(legacyCriteria)).toBe(true);
        expect(getFilteredIndices(images, legacyCriteria)).toEqual([1, 2]);
    });
});

describe('ImageFilterUtil filename search', () => {
    const images = [
        createImageData('alpha', []),
        createImageData('beta', []),
        createImageData('gamma', []),
    ];

    const searchFor = (searchText: string): number[] =>
        ImageFilterUtil.getFilteredImageIndices(
            images,
            LabelType.RECT,
            ImageFilterMode.ALL,
            searchText
        );

    it('should keep matching a single name', () => {
        expect(searchFor('beta')).toEqual([1]);
        expect(searchFor('BETA')).toEqual([1]);
    });

    it('should keep images matching any name of a comma separated list', () => {
        expect(searchFor('alpha,gamma')).toEqual([0, 2]);
        expect(searchFor(' alpha.png , GAMMA ')).toEqual([0, 2]);
        expect(searchFor('alpha,,')).toEqual([0]);
        expect(searchFor('alpha\nbeta')).toEqual([0, 1]);
    });

    it('should keep every image when no name is given', () => {
        expect(searchFor('')).toEqual([0, 1, 2]);
        expect(searchFor(' , ')).toEqual([0, 1, 2]);
    });
});

describe('ImageFilterUtil sorting by modified date', () => {
    const images = [
        createImageData('image-0', [], undefined, 3000),
        createImageData('image-1', [], undefined, 1000),
        createImageData('image-2', [], undefined, 2000),
    ];

    const sortedIndices = (sortMode: ImageSortMode): number[] =>
        ImageFilterUtil.getFilteredImageIndices(
            images,
            LabelType.RECT,
            ImageFilterMode.ALL,
            '',
            [],
            false,
            [],
            sortMode
        );

    it('should keep the import order by default', () => {
        expect(sortedIndices(ImageSortMode.DEFAULT)).toEqual([0, 1, 2]);
    });

    it('should order images by modified date in both directions', () => {
        expect(sortedIndices(ImageSortMode.MODIFIED_DATE_ASC)).toEqual([1, 2, 0]);
        expect(sortedIndices(ImageSortMode.MODIFIED_DATE_DESC)).toEqual([0, 2, 1]);
    });

    it('should resolve the next image in the active order', () => {
        // image-1 (the oldest one) dropped out of the list - the image taking its place
        // depends on the active order.
        expect(ImageFilterUtil.findNextOrderedPosition(
            images,
            [0, 2],
            1,
            ImageSortMode.DEFAULT
        )).toEqual(1);

        expect(ImageFilterUtil.findNextOrderedPosition(
            images,
            [2, 0],
            1,
            ImageSortMode.MODIFIED_DATE_ASC
        )).toEqual(0);

        expect(ImageFilterUtil.findNextOrderedPosition(
            images,
            [0, 2],
            1,
            ImageSortMode.MODIFIED_DATE_DESC
        )).toEqual(-1);
    });
});
