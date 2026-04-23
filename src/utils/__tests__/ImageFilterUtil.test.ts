import { ImageFilterMode } from '../../data/enums/ImageFilterMode';
import { LabelType } from '../../data/enums/LabelType';
import { ImageClassCriteria } from '../../store/general/types';
import { ImageData } from '../../store/labels/types';
import { ImageFilterUtil } from '../ImageFilterUtil';
import { ImageGroupUtil } from '../ImageGroupUtil';

const createImageData = (id: string, labelIds: string[], groupName?: string): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png' }),
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
