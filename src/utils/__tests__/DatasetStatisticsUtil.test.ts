import { LabelType } from '../../data/enums/LabelType';
import { LabelStatus } from '../../data/enums/LabelStatus';
import { ImageClassCriteria } from '../../store/general/types';
import { ImageData, LabelName, LabelPoint, TagConfig } from '../../store/labels/types';
import { DatasetStatisticsUtil, StatisticsItem } from '../DatasetStatisticsUtil';
import { ImageFilterUtil } from '../ImageFilterUtil';
import { ImageGroupUtil } from '../ImageGroupUtil';
import { TagUtil } from '../TagUtil';

const createPoint = (labelId: string, status: LabelStatus = LabelStatus.ACCEPTED): LabelPoint => ({
    id: `point-${labelId}-${Math.random()}`,
    labelId,
    isVisible: true,
    point: { x: 0, y: 0 },
    isCreatedByAI: false,
    status,
    suggestedLabel: null,
});

const createImageData = (
    id: string,
    points: LabelPoint[],
    tags: string[] = [],
    groupName?: string
): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png' }),
    groupName,
    loadStatus: true,
    labelRects: [],
    labelPoints: points,
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    tags,
    imgWidth: 640,
    imgHeight: 480,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const labels: LabelName[] = [
    { id: 'or', name: 'Or', color: '#ff0000' },
    { id: 'lpa', name: 'lPA', color: '#00ff00' },
    { id: 'rpa', name: 'rPA', color: '#0000ff' },
];

const tagConfig: TagConfig = TagUtil.createTagConfig(
    [
        { name: 'good', color: '#111111', groupName: 'quality' },
        { name: 'bad', color: '#222222', groupName: 'quality' },
        { name: 'loose', color: '#333333' },
    ],
    ['quality']
);

// Coupe D like dataset: Or is the origin, lPA / rPA show up on some of the images
const imagesData: ImageData[] = [
    createImageData('0', [createPoint('or'), createPoint('lpa')], ['good']),
    createImageData('1', [createPoint('or'), createPoint('lpa'), createPoint('lpa')], ['bad']),
    createImageData('2', [createPoint('or'), createPoint('rpa')]),
    createImageData('3', [createPoint('rpa')], ['good', 'loose']),
    createImageData('4', [createPoint('lpa', LabelStatus.REJECTED)]),
];

const allIndices = imagesData.map((_: ImageData, index: number) => index);

const findItem = (items: StatisticsItem[], name: string): StatisticsItem =>
    items.find((item: StatisticsItem) => item.name === name);

describe('DatasetStatisticsUtil.computeStatistics', () => {
    it('should give the share of images holding each class, tag and the summary counts', () => {
        const statistics = DatasetStatisticsUtil.computeStatistics(imagesData, allIndices, labels, tagConfig);

        expect(statistics.datasetSize).toBe(5);
        expect(statistics.populationSize).toBe(5);
        // The rejected point does not count as an annotation
        expect(statistics.annotatedImageCount).toBe(4);
        expect(statistics.taggedImageCount).toBe(3);

        expect(findItem(statistics.labels, 'Or')).toMatchObject({ imageCount: 3, datasetImageCount: 3, annotationCount: 3 });
        expect(findItem(statistics.labels, 'lPA')).toMatchObject({ imageCount: 2, datasetImageCount: 2, annotationCount: 3 });
        expect(findItem(statistics.labels, 'rPA')).toMatchObject({ imageCount: 2, datasetImageCount: 2, annotationCount: 2 });

        expect(statistics.tagSections.map((section) => section.groupName)).toEqual(['quality', null]);
        expect(statistics.tagSections[0].items.map((item) => [item.name, item.imageCount])).toEqual([['good', 2], ['bad', 1]]);
        expect(statistics.tagSections[1].items[0]).toMatchObject({
            id: TagUtil.getTagFilterTokenId('loose'),
            imageCount: 1,
        });
    });

    it('should give the co-occurrence of the other classes once the population is filtered on one', () => {
        const orFilter: ImageClassCriteria[] = [{ type: 'label', labelId: 'or' }];
        const populationIndices = ImageFilterUtil.getFilteredImageIndices(imagesData, LabelType.POINT, {
            classCriteria: orFilter,
        });
        const statistics = DatasetStatisticsUtil.computeStatistics(imagesData, populationIndices, labels, tagConfig);

        expect(statistics.populationSize).toBe(3);
        expect(findItem(statistics.labels, 'Or').imageCount).toBe(3);
        // 2 of the 3 images holding Or also hold lPA, 1 of them holds rPA
        expect(findItem(statistics.labels, 'lPA')).toMatchObject({ imageCount: 2, datasetImageCount: 2 });
        expect(findItem(statistics.labels, 'rPA')).toMatchObject({ imageCount: 1, datasetImageCount: 2 });
        expect(statistics.taggedImageCount).toBe(2);
        expect(statistics.datasetTaggedImageCount).toBe(3);
    });

    it('should list the image groups only when there is more than the default one', () => {
        expect(DatasetStatisticsUtil.computeStatistics(imagesData, allIndices, labels, tagConfig).groups).toEqual([]);

        const groupedImages = [
            { ...imagesData[0], groupName: 'D' },
            { ...imagesData[1], groupName: 'D' },
            { ...imagesData[2], groupName: 'E' },
        ];
        const statistics = DatasetStatisticsUtil.computeStatistics(groupedImages, [0, 2], labels, tagConfig);

        expect(statistics.groups).toEqual([
            expect.objectContaining({ id: ImageGroupUtil.getGroupFilterTokenId('D'), imageCount: 1, datasetImageCount: 2 }),
            expect.objectContaining({ id: ImageGroupUtil.getGroupFilterTokenId('E'), imageCount: 1, datasetImageCount: 1 }),
        ]);
    });

    it('should ignore tags and classes the project does not hold anymore', () => {
        const statistics = DatasetStatisticsUtil.computeStatistics(
            [createImageData('0', [createPoint('deleted')], ['removed-tag'])],
            [0],
            labels,
            tagConfig
        );

        expect(statistics.annotatedImageCount).toBe(0);
        expect(statistics.taggedImageCount).toBe(0);
        expect(statistics.labels.every((item) => item.imageCount === 0)).toBe(true);
    });
});

describe('DatasetStatisticsUtil filter helpers', () => {
    it('should add an item to the expression with AND, between parentheses when it holds an OR', () => {
        expect(DatasetStatisticsUtil.addCriteriaItem([], 'or')).toEqual([{ type: 'label', labelId: 'or' }]);

        expect(DatasetStatisticsUtil.addCriteriaItem([{ type: 'label', labelId: 'or' }], 'lpa')).toEqual([
            { type: 'label', labelId: 'or' },
            { type: 'operator', operator: 'AND' },
            { type: 'label', labelId: 'lpa' },
        ]);

        const withOr = DatasetStatisticsUtil.addCriteriaItem([
            { type: 'label', labelId: 'lpa' },
            { type: 'operator', operator: 'OR' },
            { type: 'label', labelId: 'rpa' },
        ], 'or');
        expect(withOr).toEqual([
            { type: 'parenthesis', value: '(' },
            { type: 'label', labelId: 'lpa' },
            { type: 'operator', operator: 'OR' },
            { type: 'label', labelId: 'rpa' },
            { type: 'parenthesis', value: ')' },
            { type: 'operator', operator: 'AND' },
            { type: 'label', labelId: 'or' },
        ]);
        expect(ImageFilterUtil.getFilteredImageIndices(imagesData, LabelType.POINT, { classCriteria: withOr }))
            .toEqual([0, 1, 2]);
    });

    it('should exclude an item with AND NOT, or with a lone NOT when there is no expression yet', () => {
        expect(DatasetStatisticsUtil.addCriteriaItem([], 'rpa', true)).toEqual([
            { type: 'operator', operator: 'NOT' },
            { type: 'label', labelId: 'rpa' },
        ]);

        const orWithoutRpa = DatasetStatisticsUtil.addCriteriaItem([{ type: 'label', labelId: 'or' }], 'rpa', true);
        expect(orWithoutRpa).toEqual([
            { type: 'label', labelId: 'or' },
            { type: 'operator', operator: 'AND' },
            { type: 'operator', operator: 'NOT' },
            { type: 'label', labelId: 'rpa' },
        ]);
        // Images 0 and 1 hold Or without rPA, image 2 holds both
        expect(ImageFilterUtil.getFilteredImageIndices(imagesData, LabelType.POINT, { classCriteria: orWithoutRpa }))
            .toEqual([0, 1]);
        expect(DatasetStatisticsUtil.getExcludedItemIds(orWithoutRpa)).toEqual(new Set(['rpa']));
    });

    it('should only report the items negated on their own as excluded', () => {
        expect(DatasetStatisticsUtil.getExcludedItemIds([
            { type: 'operator', operator: 'NOT' },
            { type: 'parenthesis', value: '(' },
            { type: 'label', labelId: 'lpa' },
            { type: 'operator', operator: 'OR' },
            { type: 'label', labelId: 'rpa' },
            { type: 'parenthesis', value: ')' },
        ])).toEqual(new Set());
    });

    it('should replace an invalid expression instead of extending it', () => {
        expect(DatasetStatisticsUtil.addCriteriaItem([{ type: 'operator', operator: 'AND' }], 'or'))
            .toEqual([{ type: 'label', labelId: 'or' }]);
    });

    it('should tell the items an expression refers to and whether one is alone', () => {
        const criteria: ImageClassCriteria[] = [
            { type: 'operator', operator: 'NOT' },
            { type: 'label', labelId: 'or' },
            { type: 'operator', operator: 'AND' },
            { type: 'label', labelId: TagUtil.getTagFilterTokenId('good') },
        ];

        expect(DatasetStatisticsUtil.getReferencedItemIds(criteria))
            .toEqual(new Set(['or', TagUtil.getTagFilterTokenId('good')]));
        expect(DatasetStatisticsUtil.isSoleCriteriaItem(criteria, 'or')).toBe(false);
        expect(DatasetStatisticsUtil.isSoleCriteriaItem([{ type: 'label', labelId: 'or' }], 'or')).toBe(true);
    });

    it('should format percentages without rounding to a misleading 0% or 100%', () => {
        expect(DatasetStatisticsUtil.formatPercentage(1, 3)).toBe('33%');
        expect(DatasetStatisticsUtil.formatPercentage(1, 20)).toBe('5%');
        expect(DatasetStatisticsUtil.formatPercentage(1, 40)).toBe('2.5%');
        expect(DatasetStatisticsUtil.formatPercentage(1, 5000)).toBe('<0.1%');
        expect(DatasetStatisticsUtil.formatPercentage(999, 1000)).toBe('>99%');
        expect(DatasetStatisticsUtil.formatPercentage(3, 3)).toBe('100%');
        expect(DatasetStatisticsUtil.formatPercentage(0, 3)).toBe('0%');
        expect(DatasetStatisticsUtil.formatPercentage(0, 0)).toBe('-');
    });
});
