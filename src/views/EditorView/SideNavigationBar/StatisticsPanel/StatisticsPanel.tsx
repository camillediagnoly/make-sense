import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Scrollbars from 'react-custom-scrollbars-2';
import './StatisticsPanel.scss';
import { AppState } from '../../../../store';
import { ImageData, LabelName, TagConfig } from '../../../../store/labels/types';
import { ImageClassCriteria, ImageClassExpressionCriteria } from '../../../../store/general/types';
import { updateActivePopupType, updateImageClassCriteria } from '../../../../store/general/actionCreators';
import { LabelType } from '../../../../data/enums/LabelType';
import { ImageFilterMode } from '../../../../data/enums/ImageFilterMode';
import { PopupWindowType } from '../../../../data/enums/PopupWindowType';
import { Settings } from '../../../../settings/Settings';
import { ImageFilterUtil } from '../../../../utils/ImageFilterUtil';
import {
    DatasetStatistics,
    DatasetStatisticsUtil,
    StatisticsItem,
    StatisticsTagSection,
} from '../../../../utils/DatasetStatisticsUtil';
import { ImageActions } from '../../../../logic/actions/ImageActions';

type SortMode = 'PROJECT' | 'FREQUENCY';
type SectionKey = 'labels' | 'tags' | 'groups';

// Kept outside of the component so the sections stay as they were left when going back and forth
// between the Images and the Statistics tabs.
let collapsedSectionsMemory: SectionKey[] = [];

interface IProps {
    imagesData: ImageData[];
    labels: LabelName[];
    tagConfig: TagConfig;
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    keepLabeledInUnlabeled: boolean;
    keptUnlabeledImageIds: string[];
    imageClassCriteria: ImageClassCriteria[];
    imageClassCriteriaLocked: boolean;
    lockedImageClassCriteriaImageIds: string[];
    updateImageClassCriteriaAction: (criteria: ImageClassCriteria[]) => any;
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
}

const sortItems = (items: StatisticsItem[], sortMode: SortMode): StatisticsItem[] => {
    if (sortMode === 'PROJECT') {
        return items;
    }

    return [...items].sort((a: StatisticsItem, b: StatisticsItem) =>
        b.imageCount - a.imageCount
        || b.datasetImageCount - a.datasetImageCount
        || a.name.localeCompare(b.name)
    );
};

const pluralize = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const StatisticsPanel: React.FC<IProps> = (
    {
        imagesData,
        labels,
        tagConfig,
        activeLabelType,
        filterMode,
        searchText,
        keepLabeledInUnlabeled,
        keptUnlabeledImageIds,
        imageClassCriteria,
        imageClassCriteriaLocked,
        lockedImageClassCriteriaImageIds,
        updateImageClassCriteriaAction,
        updateActivePopupTypeAction,
    }
) => {
    const [sortMode, setSortMode] = useState<SortMode>('PROJECT');
    const [collapsedSections, setCollapsedSections] = useState<SectionKey[]>(collapsedSectionsMemory);

    const toggleSection = (sectionKey: SectionKey) => {
        const nextCollapsedSections = collapsedSections.includes(sectionKey)
            ? collapsedSections.filter((key: SectionKey) => key !== sectionKey)
            : [...collapsedSections, sectionKey];
        collapsedSectionsMemory = nextCollapsedSections;
        setCollapsedSections(nextCollapsedSections);
    };

    // The population is exactly the list of images the Images tab shows
    const populationIndices: number[] = useMemo(
        () => ImageFilterUtil.getFilteredImageIndices(imagesData, activeLabelType, {
            filterMode,
            searchText,
            classCriteria: imageClassCriteria,
            classCriteriaLocked: imageClassCriteriaLocked,
            lockedClassCriteriaImageIds: lockedImageClassCriteriaImageIds,
            keepLabeledInUnlabeled,
            keptUnlabeledImageIds,
        }),
        [
            imagesData,
            activeLabelType,
            filterMode,
            searchText,
            imageClassCriteria,
            imageClassCriteriaLocked,
            lockedImageClassCriteriaImageIds,
            keepLabeledInUnlabeled,
            keptUnlabeledImageIds,
        ]
    );

    const statistics: DatasetStatistics = useMemo(
        () => DatasetStatisticsUtil.computeStatistics(imagesData, populationIndices, labels, tagConfig),
        [imagesData, populationIndices, labels, tagConfig]
    );

    const referencedItemIds: Set<string> = useMemo(
        () => DatasetStatisticsUtil.getReferencedItemIds(imageClassCriteria),
        [imageClassCriteria]
    );

    const excludedItemIds: Set<string> = useMemo(
        () => DatasetStatisticsUtil.getExcludedItemIds(imageClassCriteria),
        [imageClassCriteria]
    );

    const criteriaTokens: ImageClassExpressionCriteria[] = useMemo(
        () => ImageFilterUtil.normalizeImageClassCriteria(imageClassCriteria),
        [imageClassCriteria]
    );

    // The Images tab moves the editor onto a matching image whenever the filter changes. It is not
    // mounted while this tab is shown, so this one takes over (skipping the first render: opening
    // the tab is not a filter change).
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        ImageActions.syncActiveImageWithFilters();
    }, [imageClassCriteria, imageClassCriteriaLocked, lockedImageClassCriteriaImageIds]);

    const { datasetSize, populationSize } = statistics;
    const isFiltered = populationSize !== datasetSize;

    const itemNameById: Map<string, string> = useMemo(() => {
        const names = new Map<string, string>();
        [
            ...statistics.labels,
            ...statistics.tagSections.flatMap((section: StatisticsTagSection) => section.items),
            ...statistics.groups,
        ].forEach((item: StatisticsItem) => names.set(item.id, item.name));
        return names;
    }, [statistics]);

    const describeCriteria = (): string => criteriaTokens
        .map((token: ImageClassExpressionCriteria) => {
            switch (token.type) {
                case 'label':
                    return itemNameById.get(token.labelId) || '[missing]';
                case 'otherLabels':
                    return 'OTHERS';
                case 'operator':
                    return token.operator;
                default:
                    return token.value;
            }
        })
        .join(' ')
        .replace(/\( /g, '(')
        .replace(/ \)/g, ')');

    const getOtherFilterDescriptions = (): string[] => {
        const descriptions: string[] = [];
        if (searchText.trim().length > 0) {
            descriptions.push(`name search "${searchText.trim()}"`);
        }
        if (filterMode === ImageFilterMode.LABELED) {
            descriptions.push('labeled images only');
        } else if (filterMode === ImageFilterMode.UNLABELED) {
            descriptions.push('unlabeled images only');
        }
        return descriptions;
    };

    // Click: this item only (again to clear) - Ctrl+click: AND item - Ctrl+Shift+click: AND NOT item
    const onItemClick = (item: StatisticsItem, event: React.MouseEvent | React.KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
            if (!referencedItemIds.has(item.id)) {
                updateImageClassCriteriaAction(
                    DatasetStatisticsUtil.addCriteriaItem(imageClassCriteria, item.id, event.shiftKey)
                );
            }
            return;
        }

        updateImageClassCriteriaAction(
            DatasetStatisticsUtil.isSoleCriteriaItem(imageClassCriteria, item.id)
                ? []
                : [{ type: 'label', labelId: item.id }]
        );
    };

    const formatShare = (count: number, total: number) => DatasetStatisticsUtil.formatPercentage(count, total);

    const getItemTooltip = (item: StatisticsItem): string => {
        const lines = [`${item.name}: ${pluralize(item.imageCount, 'image')}`];
        if (isFiltered) {
            lines.push(
                `${formatShare(item.imageCount, populationSize)} of the ${populationSize} filtered images`,
                `${formatShare(item.imageCount, datasetSize)} of the ${datasetSize} images of the dataset`,
                `Without the filter: ${pluralize(item.datasetImageCount, 'image')} (${formatShare(item.datasetImageCount, datasetSize)} of the dataset)`
            );
        } else {
            lines.push(`${formatShare(item.imageCount, datasetSize)} of the ${datasetSize} images of the dataset`);
        }
        if (item.kind === 'label') {
            lines.push(`${pluralize(item.annotationCount, 'label')} drawn`);
        }
        lines.push(
            '',
            'Click: filter on this item only (click again to clear)',
            'Ctrl+click: add it to the filter (AND)',
            'Ctrl+Shift+click: exclude it from the filter (AND NOT)'
        );
        return lines.join('\n');
    };

    const renderBar = (className: string, share: number) => (
        <div className={classNames('BarTrack', className)}>
            {share > 0 && <div className='BarFill' style={{ width: `${share}%` }}/>}
        </div>
    );

    const renderRow = (item: StatisticsItem) => {
        const isExcluded = excludedItemIds.has(item.id);

        return (
            <div
                key={item.id}
                className={classNames('StatisticsRow', {
                    'in-filter': referencedItemIds.has(item.id) && !isExcluded,
                    'excluded': isExcluded,
                    'empty': item.imageCount === 0,
                })}
                role='button'
                tabIndex={0}
                title={getItemTooltip(item)}
                onClick={(event: React.MouseEvent) => onItemClick(item, event)}
                onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Enter') {
                        onItemClick(item, event);
                    }
                }}
            >
                <div className='RowHeader'>
                    <span
                        className='ColorDot'
                        style={item.color ? { backgroundColor: item.color } : undefined}
                    />
                    <span className='ItemName'>{item.name}</span>
                    {isExcluded && <span className='NotBadge'>NOT</span>}
                    <span className='ItemCount'>{item.imageCount}</span>
                    {isFiltered && (
                        <span className='ItemShare filtered'>{formatShare(item.imageCount, populationSize)}</span>
                    )}
                    <span className='ItemShare dataset'>{formatShare(item.imageCount, datasetSize)}</span>
                </div>
                <div className='Bars'>
                    {isFiltered && renderBar('filtered', DatasetStatisticsUtil.getPercentage(item.imageCount, populationSize))}
                    {renderBar('dataset', DatasetStatisticsUtil.getPercentage(item.imageCount, datasetSize))}
                </div>
            </div>
        );
    };

    const renderColumnsHeader = () => (
        <div className='ColumnsHeader'>
            <span className='ItemName'/>
            <span className='ItemCount'>images</span>
            {isFiltered && (
                <span className='ItemShare filtered' title='Share of the filtered images'>
                    <span className='Swatch'/>% filtered
                </span>
            )}
            <span className='ItemShare dataset' title='Share of all the images of the dataset'>
                <span className='Swatch'/>% dataset
            </span>
        </div>
    );

    const renderSection = (
        sectionKey: SectionKey,
        title: string,
        icon: string,
        itemCount: number,
        renderContent: () => React.ReactNode
    ) => {
        const isExpanded = !collapsedSections.includes(sectionKey);
        return (
            <div className='StatisticsSection' key={sectionKey}>
                <div
                    className={classNames('SectionHeader', { 'expanded': isExpanded })}
                    style={{ height: Settings.TOOLKIT_TAB_HEIGHT_PX }}
                    role='button'
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleSection(sectionKey)}
                    onKeyDown={(event: React.KeyboardEvent) => {
                        if (event.key === 'Enter') {
                            toggleSection(sectionKey);
                        }
                    }}
                >
                    <div className='Marker'/>
                    <div className='HeaderGroupWrapper'>
                        <img draggable={false} className='Ico' src={icon} alt=''/>
                        {title}
                        <span className='SectionItemCount'>{itemCount}</span>
                    </div>
                    <div className='HeaderGroupWrapper'>
                        <img draggable={false} className='Arrow' src='ico/down.png' alt=''/>
                    </div>
                </div>
                {isExpanded && <div className='SectionContent'>
                    {renderColumnsHeader()}
                    {renderContent()}
                </div>}
            </div>
        );
    };

    const renderKpi = (caption: string, value: number, details: React.ReactNode) => (
        <div className='Kpi'>
            <div className='KpiCaption'>{caption}</div>
            <div className='KpiValue'>{value}</div>
            {details}
        </div>
    );

    // The share of the population (when filtered) and of the dataset, each with the swatch of its bar
    const renderKpiShares = (count: number) => <>
        {isFiltered && (
            <div className='KpiDetail filtered' title='Share of the filtered images'>
                <span className='Swatch'/>{formatShare(count, populationSize)}
            </div>
        )}
        <div className='KpiDetail dataset' title='Share of all the images of the dataset'>
            <span className='Swatch'/>{formatShare(count, datasetSize)}
        </div>
    </>;

    const renderSummary = () => {
        const otherFilters = getOtherFilterDescriptions();
        return (
            <div className='StatisticsSummary'>
                <div className='KpiRow'>
                    {renderKpi(
                        'Images',
                        populationSize,
                        <div className='KpiDetail'>
                            {isFiltered ? `${formatShare(populationSize, datasetSize)} of ${datasetSize}` : 'whole dataset'}
                        </div>
                    )}
                    {renderKpi('Labeled', statistics.annotatedImageCount, renderKpiShares(statistics.annotatedImageCount))}
                    {statistics.tagSections.length > 0 && renderKpi(
                        'Tagged',
                        statistics.taggedImageCount,
                        renderKpiShares(statistics.taggedImageCount)
                    )}
                </div>
                <div className='FilterBox'>
                    <div className='FilterBoxHeader'>
                        <span className='FilterBoxTitle'>
                            Labels filter
                            {imageClassCriteriaLocked && <span className='FrozenBadge'>frozen</span>}
                        </span>
                        <span className='FilterBoxActions'>
                            <button
                                type='button'
                                className='FilterBoxButton'
                                onClick={() => updateActivePopupTypeAction(PopupWindowType.IMAGE_CLASS_FILTER)}
                            >
                                Edit
                            </button>
                            {criteriaTokens.length > 0 && (
                                <button
                                    type='button'
                                    className='FilterBoxButton'
                                    onClick={() => updateImageClassCriteriaAction([])}
                                >
                                    Clear
                                </button>
                            )}
                        </span>
                    </div>
                    {criteriaTokens.length > 0
                        ? <div className='FilterExpression'>{describeCriteria()}</div>
                        : <div className='FilterHint'>None</div>}
                    <div className='FilterHint'>
                        Click a row: only this item · Ctrl+click: AND · Ctrl+Shift+click: AND NOT
                    </div>
                    {otherFilters.length > 0 && (
                        <div className='OtherFilters'>Images tab: {otherFilters.join(', ')}</div>
                    )}
                </div>
                <div className='SortRow'>
                    <span className='SortLabel'>Sort</span>
                    <select
                        className='SortSelect'
                        value={sortMode}
                        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                            setSortMode(event.target.value as SortMode)}
                        aria-label='Sort statistics'
                    >
                        <option value='PROJECT'>Project order</option>
                        <option value='FREQUENCY'>Most frequent first</option>
                    </select>
                </div>
            </div>
        );
    };

    const renderTagSections = () => statistics.tagSections.map((section: StatisticsTagSection) => (
        <React.Fragment key={section.groupName ?? ''}>
            {statistics.tagSections.length > 1 || section.groupName !== null
                ? <div className='SubsectionTitle'>{section.groupName ?? 'Other tags'}</div>
                : null}
            {sortItems(section.items, sortMode).map(renderRow)}
        </React.Fragment>
    ));

    const renderBody = () => {
        if (datasetSize === 0) {
            return <div className='StatisticsEmptyState'>No images loaded yet.</div>;
        }
        if (populationSize === 0) {
            return <div className='StatisticsEmptyState'>No images match the current filters.</div>;
        }

        const tagCount = statistics.tagSections
            .reduce((count: number, section: StatisticsTagSection) => count + section.items.length, 0);

        return <>
            {renderSection('labels', 'Labels', 'ico/tags.png', statistics.labels.length, () =>
                statistics.labels.length > 0
                    ? sortItems(statistics.labels, sortMode).map(renderRow)
                    : <div className='StatisticsEmptyState'>No label classes yet.</div>
            )}
            {tagCount > 0 && renderSection('tags', 'Tags', 'ico/labels.png', tagCount, renderTagSections)}
            {statistics.groups.length > 0 && renderSection(
                'groups',
                'Image groups',
                'ico/files.png',
                statistics.groups.length,
                () => sortItems(statistics.groups, sortMode).map(renderRow)
            )}
        </>;
    };

    return (
        <div className='StatisticsPanel'>
            {renderSummary()}
            <div className='StatisticsBody'>
                <Scrollbars autoHide={true} style={{ position: 'absolute', top: 0, left: 0 }}>
                    <div className='StatisticsContent'>
                        {renderBody()}
                    </div>
                </Scrollbars>
            </div>
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    imagesData: state.labels.imagesData,
    labels: state.labels.labels,
    tagConfig: state.labels.tagConfig,
    activeLabelType: state.labels.activeLabelType,
    filterMode: state.general.imageListFilterMode,
    searchText: state.general.imageListSearchText,
    keepLabeledInUnlabeled: state.general.keepLabeledInUnlabeled,
    keptUnlabeledImageIds: state.general.keptUnlabeledImageIds,
    imageClassCriteria: state.general.imageClassCriteria,
    imageClassCriteriaLocked: state.general.imageClassCriteriaLocked,
    lockedImageClassCriteriaImageIds: state.general.lockedImageClassCriteriaImageIds,
});

const mapDispatchToProps = {
    updateImageClassCriteriaAction: updateImageClassCriteria,
    updateActivePopupTypeAction: updateActivePopupType,
};

export default connect(mapStateToProps, mapDispatchToProps)(StatisticsPanel);
