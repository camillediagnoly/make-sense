import { LabelStatus } from '../data/enums/LabelStatus';
import { ImageData, LabelName, TagConfig, TagName } from '../store/labels/types';
import { ImageClassCriteria, ImageClassExpressionCriteria } from '../store/general/types';
import { ImageFilterUtil } from './ImageFilterUtil';
import { ImageGroupUtil } from './ImageGroupUtil';
import { TagGroup, TagUtil } from './TagUtil';

export type StatisticsItemKind = 'label' | 'tag' | 'group';

export type StatisticsItem = {
    // The id the Labels Filter knows the item by: the label id, or the tag / group filter token id
    id: string;
    kind: StatisticsItemKind;
    name: string;
    color?: string;
    // Images of the population carrying the item
    imageCount: number;
    // Same thing over the whole dataset, whatever the filters
    datasetImageCount: number;
    // Annotations (boxes, points, polygons, lines, image labels) of that class in the population
    annotationCount: number;
};

export type StatisticsTagSection = {
    groupName: string | null;
    items: StatisticsItem[];
};

export type DatasetStatistics = {
    datasetSize: number;
    populationSize: number;
    annotatedImageCount: number;
    datasetAnnotatedImageCount: number;
    taggedImageCount: number;
    datasetTaggedImageCount: number;
    labels: StatisticsItem[];
    tagSections: StatisticsTagSection[];
    groups: StatisticsItem[];
};

type ItemCounter = {
    imageCount: number;
    datasetImageCount: number;
    annotationCount: number;
};

export class DatasetStatisticsUtil {
    // The population is the list of images the stats are computed on (usually the images matching
    // the image list filters). Every proportion is a share of that population: with a filter on a
    // class A, the line of a class B tells how many of the images holding A also hold B.
    public static computeStatistics(
        imagesData: ImageData[],
        populationIndices: number[],
        labels: LabelName[],
        tagConfig: TagConfig
    ): DatasetStatistics {
        const populationIndexSet = new Set<number>(populationIndices);
        const tagNames: string[] = TagUtil.getTagNames(tagConfig);
        const groupNames: string[] = ImageGroupUtil.getFilterableGroupNames(imagesData);

        const createCounters = (ids: string[]): Map<string, ItemCounter> => new Map(
            ids.map((id: string): [string, ItemCounter] => [
                id,
                { imageCount: 0, datasetImageCount: 0, annotationCount: 0 }
            ])
        );
        const labelCounters = createCounters(labels.map((label: LabelName) => label.id));
        const tagCounters = createCounters(tagNames);
        const groupCounters = createCounters(groupNames);

        let populationSize = 0;
        let annotatedImageCount = 0;
        let datasetAnnotatedImageCount = 0;
        let taggedImageCount = 0;
        let datasetTaggedImageCount = 0;

        const countImage = (
            counters: Map<string, ItemCounter>,
            id: string,
            isInPopulation: boolean
        ): boolean => {
            const counter = counters.get(id);
            if (!counter) {
                return false;
            }

            counter.datasetImageCount += 1;
            if (isInPopulation) {
                counter.imageCount += 1;
            }
            return true;
        };

        imagesData.forEach((imageData: ImageData, index: number) => {
            const isInPopulation = populationIndexSet.has(index);
            if (isInPopulation) {
                populationSize += 1;
            }

            let isAnnotated = false;
            ImageFilterUtil.getImageAssignedClassLabelIds(imageData).forEach((labelId: string) => {
                isAnnotated = countImage(labelCounters, labelId, isInPopulation) || isAnnotated;
            });
            if (isAnnotated) {
                datasetAnnotatedImageCount += 1;
                annotatedImageCount += isInPopulation ? 1 : 0;
            }

            if (isInPopulation) {
                DatasetStatisticsUtil.getImageAnnotationLabelIds(imageData).forEach((labelId: string) => {
                    const counter = labelCounters.get(labelId);
                    if (counter) {
                        counter.annotationCount += 1;
                    }
                });
            }

            const imageTags: string[] = TagUtil.getActiveTagNames(imageData, tagNames);
            imageTags.forEach((tagName: string) => countImage(tagCounters, tagName, isInPopulation));
            if (imageTags.length > 0) {
                datasetTaggedImageCount += 1;
                taggedImageCount += isInPopulation ? 1 : 0;
            }

            countImage(groupCounters, ImageGroupUtil.getImageGroupName(imageData), isInPopulation);
        });

        const toTagItem = (tag: TagName): StatisticsItem => ({
            id: TagUtil.getTagFilterTokenId(tag.name),
            kind: 'tag',
            name: tag.name,
            color: tag.color,
            ...tagCounters.get(tag.name),
        });

        return {
            datasetSize: imagesData.length,
            populationSize,
            annotatedImageCount,
            datasetAnnotatedImageCount,
            taggedImageCount,
            datasetTaggedImageCount,
            labels: labels.map((label: LabelName): StatisticsItem => ({
                id: label.id,
                kind: 'label',
                name: label.name,
                color: label.color,
                ...labelCounters.get(label.id),
            })),
            tagSections: TagUtil.getTagGroups(tagConfig)
                .map((tagGroup: TagGroup): StatisticsTagSection => ({
                    groupName: tagGroup.groupName,
                    items: tagGroup.tags.map(toTagItem),
                }))
                .filter((section: StatisticsTagSection) => section.items.length > 0),
            groups: groupNames.map((groupName: string): StatisticsItem => ({
                id: ImageGroupUtil.getGroupFilterTokenId(groupName),
                kind: 'group',
                name: groupName,
                ...groupCounters.get(groupName),
            })),
        };
    }

    // One entry per annotation, the same ones the Labels Filter looks at: accepted boxes and
    // points, polygons, lines and image level labels.
    private static getImageAnnotationLabelIds(imageData: ImageData): string[] {
        return [
            ...(imageData.labelNameIds || []),
            ...imageData.labelRects
                .filter((labelRect) => labelRect.status === LabelStatus.ACCEPTED)
                .map((labelRect) => labelRect.labelId),
            ...imageData.labelPoints
                .filter((labelPoint) => labelPoint.status === LabelStatus.ACCEPTED)
                .map((labelPoint) => labelPoint.labelId),
            ...imageData.labelPolygons.map((labelPolygon) => labelPolygon.labelId),
            ...imageData.labelLines.map((labelLine) => labelLine.labelId),
        ].filter((labelId: string | null) => !!labelId);
    }

    // The filter item ids (labels, tags, groups) an expression refers to
    public static getReferencedItemIds(classCriteria: ImageClassCriteria[]): Set<string> {
        const itemIds = new Set<string>();
        ImageFilterUtil.normalizeImageClassCriteria(classCriteria).forEach((criteria) => {
            if (criteria.type === 'label') {
                itemIds.add(criteria.labelId);
            }
        });
        return itemIds;
    }

    public static isSoleCriteriaItem(classCriteria: ImageClassCriteria[], itemId: string): boolean {
        const criteria = ImageFilterUtil.normalizeImageClassCriteria(classCriteria);
        return criteria.length === 1 && criteria[0].type === 'label' && criteria[0].labelId === itemId;
    }

    // The items an expression rules out directly (`NOT item`). An item under a negated group, like
    // `NOT (A OR B)`, is not reported.
    public static getExcludedItemIds(classCriteria: ImageClassCriteria[]): Set<string> {
        const itemIds = new Set<string>();
        ImageFilterUtil.normalizeImageClassCriteria(classCriteria).forEach((criteria, index, criteriaList) => {
            const previous = criteriaList[index - 1];
            if (criteria.type === 'label' && previous?.type === 'operator' && previous.operator === 'NOT') {
                itemIds.add(criteria.labelId);
            }
        });
        return itemIds;
    }

    // Narrows the current expression down to the images also holding the item (`expr AND item`),
    // or to the ones not holding it when negated (`expr AND NOT item`). The expression is put
    // between parentheses when it holds an OR, since AND binds tighter.
    public static addCriteriaItem(
        classCriteria: ImageClassCriteria[],
        itemId: string,
        isNegated: boolean = false
    ): ImageClassExpressionCriteria[] {
        const criteria = ImageFilterUtil.normalizeImageClassCriteria(classCriteria);
        const itemTokens: ImageClassExpressionCriteria[] = [
            ...(isNegated ? [{ type: 'operator', operator: 'NOT' } as ImageClassExpressionCriteria] : []),
            { type: 'label', labelId: itemId },
        ];
        if (criteria.length === 0 || !ImageFilterUtil.isImageClassCriteriaValid(criteria)) {
            return itemTokens;
        }

        const needsParentheses = criteria.some((token: ImageClassExpressionCriteria) =>
            token.type === 'operator' && token.operator === 'OR'
        );
        return [
            ...(needsParentheses
                ? [
                    { type: 'parenthesis', value: '(' } as ImageClassExpressionCriteria,
                    ...criteria,
                    { type: 'parenthesis', value: ')' } as ImageClassExpressionCriteria,
                ]
                : criteria),
            { type: 'operator', operator: 'AND' },
            ...itemTokens,
        ];
    }

    public static getPercentage(count: number, total: number): number {
        return total > 0 ? (count / total) * 100 : 0;
    }

    // One decimal under 10% where it matters, none above, and never a misleading 0% or 100%
    public static formatPercentage(count: number, total: number): string {
        if (total <= 0) {
            return '-';
        }

        const percentage = DatasetStatisticsUtil.getPercentage(count, total);
        if (count > 0 && percentage < 0.1) {
            return '<0.1%';
        }
        if (count < total && percentage > 99.5) {
            return '>99%';
        }
        return percentage < 10
            ? `${Number(percentage.toFixed(1))}%`
            : `${Math.round(percentage)}%`;
    }
}
