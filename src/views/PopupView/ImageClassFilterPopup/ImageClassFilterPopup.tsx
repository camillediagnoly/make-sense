import React, { useEffect, useMemo, useState } from 'react';
import './ImageClassFilterPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { connect } from 'react-redux';
import { AppState } from '../../../store';
import { ImageData, LabelName } from '../../../store/labels/types';
import {
    ImageClassCriteria,
    ImageClassExpressionCriteria,
} from '../../../store/general/types';
import {
    updateActivePopupType,
    updateImageClassCriteria,
} from '../../../store/general/actionCreators';
import { ImageFilterMode } from '../../../data/enums/ImageFilterMode';
import { LabelType } from '../../../data/enums/LabelType';
import { ImageFilterUtil } from '../../../utils/ImageFilterUtil';
import Scrollbars from 'react-custom-scrollbars-2';
import { ImageGroupUtil } from '../../../utils/ImageGroupUtil';

const DRAG_DATA_TYPE = 'application/x-image-filter-criteria-token';

const OPERATOR_LIBRARY: ImageClassExpressionCriteria[] = [
    { type: 'operator', operator: 'AND' },
    { type: 'operator', operator: 'OR' },
    { type: 'operator', operator: 'NOT' },
    { type: 'otherLabels' },
    { type: 'parenthesis', value: '(' },
    { type: 'parenthesis', value: ')' },
];

type CanvasToken = ImageClassExpressionCriteria & {
    id: string;
};

type DragPayload =
    | {
        source: 'palette';
        token: ImageClassExpressionCriteria;
    }
    | {
        source: 'canvas';
        tokenId: string;
    };

interface IProps {
    labels: LabelName[];
    imagesData: ImageData[];
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    keepLabeledInUnlabeled: boolean;
    keptUnlabeledImageIds: string[];
    imageClassCriteria: ImageClassCriteria[];
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    updateImageClassCriteriaAction: (criteria: ImageClassCriteria[]) => any;
}

let tokenIdCounter = 0;
const createTokenId = (): string => {
    tokenIdCounter += 1;
    return `image-filter-token-${tokenIdCounter}`;
};

const toCanvasToken = (token: ImageClassExpressionCriteria): CanvasToken => ({
    ...token,
    id: createTokenId(),
});

const toCanvasTokens = (criteria: ImageClassCriteria[]): CanvasToken[] =>
    ImageFilterUtil.normalizeImageClassCriteria(criteria).map(
        (token: ImageClassExpressionCriteria) => toCanvasToken(token)
    );

const toCriteriaTokens = (tokens: CanvasToken[]): ImageClassExpressionCriteria[] =>
    tokens.map(({ id, ...token }: CanvasToken) => token);

const serializeDragPayload = (payload: DragPayload): string => JSON.stringify(payload);

const parseDragPayload = (rawPayload: string | null): DragPayload | null => {
    if (!rawPayload) {
        return null;
    }

    try {
        const payload = JSON.parse(rawPayload) as DragPayload;
        if (!payload || typeof payload !== 'object' || !('source' in payload)) {
            return null;
        }

        if (payload.source === 'palette' && 'token' in payload) {
            return payload;
        }

        if (payload.source === 'canvas' && 'tokenId' in payload) {
            return payload;
        }
    } catch {
        return null;
    }

    return null;
};

const ImageClassFilterPopup: React.FC<IProps> = (
    {
        labels,
        imagesData,
        activeLabelType,
        filterMode,
        searchText,
        keepLabeledInUnlabeled,
        keptUnlabeledImageIds,
        imageClassCriteria,
        updateActivePopupTypeAction,
        updateImageClassCriteriaAction,
    }
) => {
    const [canvasTokens, setCanvasTokens] = useState<CanvasToken[]>(
        toCanvasTokens(imageClassCriteria)
    );
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    useEffect(() => {
        setCanvasTokens(toCanvasTokens(imageClassCriteria));
    }, [imageClassCriteria]);

    const filterableGroupNames = useMemo(
        () => ImageGroupUtil.getFilterableGroupNames(imagesData),
        [imagesData]
    );

    const filterItemNameById = useMemo(
        () => {
            const itemNames = new Map<string, string>();

            labels.forEach((label: LabelName) => {
                itemNames.set(label.id, label.name);
            });

            filterableGroupNames.forEach((groupName: string) => {
                itemNames.set(
                    ImageGroupUtil.getGroupFilterTokenId(groupName),
                    groupName
                );
            });

            return itemNames;
        },
        [labels, filterableGroupNames]
    );

    const draftCriteria = useMemo(
        () => toCriteriaTokens(canvasTokens),
        [canvasTokens]
    );

    const isExpressionValid = useMemo(
        () => ImageFilterUtil.isImageClassCriteriaValid(draftCriteria),
        [draftCriteria]
    );

    const usedFilterItemIds = useMemo(() => {
        const ids = new Set<string>();
        canvasTokens.forEach((token: CanvasToken) => {
            if (token.type === 'label') {
                ids.add(token.labelId);
            }
        });
        return ids;
    }, [canvasTokens]);

    const availableGroupNames = useMemo(
        () =>
            filterableGroupNames.filter(
                (groupName: string) =>
                    !usedFilterItemIds.has(
                        ImageGroupUtil.getGroupFilterTokenId(groupName)
                    )
            ),
        [filterableGroupNames, usedFilterItemIds]
    );

    const availableLabels = useMemo(
        () =>
            labels.filter((label: LabelName) => !usedFilterItemIds.has(label.id)),
        [labels, usedFilterItemIds]
    );

    const filteredImagesCount = useMemo(
        () =>
            ImageFilterUtil.getFilteredImageIndices(
                imagesData,
                activeLabelType,
                filterMode,
                searchText,
                draftCriteria,
                keepLabeledInUnlabeled,
                keptUnlabeledImageIds
            ).length,
        [
            imagesData,
            activeLabelType,
            filterMode,
            searchText,
            draftCriteria,
            keepLabeledInUnlabeled,
            keptUnlabeledImageIds,
        ]
    );

    const appendToken = (token: ImageClassExpressionCriteria) => {
        setCanvasTokens((previousTokens: CanvasToken[]) => {
            if (
                token.type === 'label' &&
                previousTokens.some(
                    (existingToken: CanvasToken) =>
                        existingToken.type === 'label' &&
                        existingToken.labelId === token.labelId
                )
            ) {
                return previousTokens;
            }

            if (
                token.type === 'otherLabels' &&
                previousTokens.some((existingToken: CanvasToken) => existingToken.type === 'otherLabels')
            ) {
                return previousTokens;
            }

            return [...previousTokens, toCanvasToken(token)];
        });
    };

    const insertTokenAt = (
        token: ImageClassExpressionCriteria,
        index: number
    ) => {
        setCanvasTokens((previousTokens: CanvasToken[]) => {
            if (
                token.type === 'label' &&
                previousTokens.some(
                    (existingToken: CanvasToken) =>
                        existingToken.type === 'label' &&
                        existingToken.labelId === token.labelId
                )
            ) {
                return previousTokens;
            }

            if (
                token.type === 'otherLabels' &&
                previousTokens.some((existingToken: CanvasToken) => existingToken.type === 'otherLabels')
            ) {
                return previousTokens;
            }

            const newToken = toCanvasToken(token);
            const boundedIndex = Math.max(0, Math.min(index, previousTokens.length));

            return [
                ...previousTokens.slice(0, boundedIndex),
                newToken,
                ...previousTokens.slice(boundedIndex),
            ];
        });
    };

    const moveCanvasToken = (tokenId: string, targetIndex: number) => {
        setCanvasTokens((previousTokens: CanvasToken[]) => {
            const sourceIndex = previousTokens.findIndex(
                (token: CanvasToken) => token.id === tokenId
            );

            if (sourceIndex < 0) {
                return previousTokens;
            }

            const movedToken = previousTokens[sourceIndex];
            const withoutToken = previousTokens.filter(
                (token: CanvasToken) => token.id !== tokenId
            );
            const boundedTargetIndex = Math.max(
                0,
                Math.min(targetIndex, previousTokens.length)
            );
            const adjustedIndex =
                sourceIndex < targetIndex ? boundedTargetIndex - 1 : boundedTargetIndex;
            const safeIndex = Math.max(0, Math.min(adjustedIndex, withoutToken.length));

            return [
                ...withoutToken.slice(0, safeIndex),
                movedToken,
                ...withoutToken.slice(safeIndex),
            ];
        });
    };

    const removeTokenById = (tokenId: string) => {
        setCanvasTokens((previousTokens: CanvasToken[]) =>
            previousTokens.filter((token: CanvasToken) => token.id !== tokenId)
        );
    };

    const onDragStart = (event: React.DragEvent, payload: DragPayload) => {
        const serializedPayload = serializeDragPayload(payload);
        event.dataTransfer.setData(DRAG_DATA_TYPE, serializedPayload);
        event.dataTransfer.setData('text/plain', serializedPayload);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDropAtIndex = (event: React.DragEvent, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOverIndex(null);

        const payload = parseDragPayload(event.dataTransfer.getData(DRAG_DATA_TYPE))
            || parseDragPayload(event.dataTransfer.getData('text/plain'));

        if (!payload) {
            return;
        }

        if (payload.source === 'palette') {
            insertTokenAt(payload.token, index);
            return;
        }

        moveCanvasToken(payload.tokenId, index);
    };

    const onDropToCanvasEnd = (event: React.DragEvent) => {
        if (event.target !== event.currentTarget) {
            return;
        }
        onDropAtIndex(event, canvasTokens.length);
    };

    const getDropIndexFromPointer = (
        event: React.DragEvent<HTMLDivElement>,
        index: number
    ): number => {
        const target = event.currentTarget;
        const { left, width } = target.getBoundingClientRect();
        const midpoint = left + width / 2;

        return event.clientX >= midpoint ? index + 1 : index;
    };

    const onAccept = () => {
        if (!isExpressionValid) {
            return;
        }

        updateImageClassCriteriaAction(draftCriteria);
        updateActivePopupTypeAction(null);
    };

    const onReject = () => {
        updateActivePopupTypeAction(null);
    };

    const onClear = () => {
        setCanvasTokens([]);
        setDragOverIndex(null);
    };

    const getTokenLabel = (token: CanvasToken): string => {
        if (token.type === 'label') {
            return filterItemNameById.get(token.labelId) || '[Missing filter item]';
        }

        if (token.type === 'otherLabels') {
            return 'OTHERS';
        }

        if (token.type === 'operator') {
            return token.operator;
        }

        return token.value;
    };

    const getCanvasTokenClassName = (token: CanvasToken): string => {
        if (token.type === 'otherLabels') {
            return 'CanvasToken otherLabels';
        }

        if (token.type === 'label') {
            return ImageGroupUtil.isGroupFilterTokenId(token.labelId)
                ? 'CanvasToken group'
                : 'CanvasToken label';
        }

        if (token.type === 'operator') {
            return `CanvasToken operator ${token.operator.toLowerCase()}`;
        }

        return 'CanvasToken parenthesis';
    };

    const renderFilterItemLibrary = () => {
        if (labels.length === 0 && filterableGroupNames.length === 0) {
            return <div className='EmptyState'>No labels or groups found yet.</div>;
        }

        return (
            <Scrollbars autoHide={true}>
                <div className='LibrarySections'>
                    {filterableGroupNames.length > 0 && (
                        <div className='LibrarySection'>
                            <div className='SectionLabel'>Image Groups</div>
                            {availableGroupNames.length > 0 ? (
                                <div className='TokenBank'>
                                    {availableGroupNames.map((groupName: string) => {
                                        const groupToken = {
                                            type: 'label' as const,
                                            labelId: ImageGroupUtil.getGroupFilterTokenId(groupName),
                                        };

                                        return (
                                            <button
                                                key={groupName}
                                                type='button'
                                                className='LibraryToken group'
                                                onClick={() => appendToken(groupToken)}
                                                draggable={true}
                                                onDragStart={(event: React.DragEvent) =>
                                                    onDragStart(event, {
                                                        source: 'palette',
                                                        token: groupToken,
                                                    })
                                                }
                                            >
                                                {groupName}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className='EmptyState'>All image groups are already used in the condition.</div>
                            )}
                        </div>
                    )}

                    <div className='LibrarySection'>
                        <div className='SectionLabel'>Classes</div>
                        {labels.length === 0 && (
                            <div className='EmptyState'>No labels found. Add labels first.</div>
                        )}

                        {labels.length > 0 && availableLabels.length === 0 && (
                            <div className='EmptyState'>All classes are already used in the condition.</div>
                        )}

                        {availableLabels.length > 0 && (
                            <div className='TokenBank'>
                                {availableLabels.map((label: LabelName) => {
                                    const classToken = {
                                        type: 'label' as const,
                                        labelId: label.id,
                                    };

                                    return (
                                        <button
                                            key={label.id}
                                            type='button'
                                            className='LibraryToken label'
                                            onClick={() => appendToken(classToken)}
                                            draggable={true}
                                            onDragStart={(event: React.DragEvent) =>
                                                onDragStart(event, {
                                                    source: 'palette',
                                                    token: classToken,
                                                })
                                            }
                                        >
                                            {label.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Scrollbars>
        );
    };

    const renderCanvasDropSlot = (index: number) => (
        <div
            key={`drop-slot-${index}`}
            className={`DropSlot ${dragOverIndex === index ? 'active' : ''}`}
            onDragOver={(event: React.DragEvent) => {
                event.preventDefault();
                event.stopPropagation();
                setDragOverIndex(index);
                event.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={() => {
                if (dragOverIndex === index) {
                    setDragOverIndex(null);
                }
            }}
            onDrop={(event: React.DragEvent) => onDropAtIndex(event, index)}
        />
    );

    const renderCanvasToken = (token: CanvasToken) => (
        <div
            key={token.id}
            className={getCanvasTokenClassName(token)}
            draggable={true}
            onClick={() => removeTokenById(token.id)}
            onDragStart={(event: React.DragEvent) =>
                onDragStart(event, {
                    source: 'canvas',
                    tokenId: token.id,
                })
            }
            title='Click to remove'
        >
            <span>{getTokenLabel(token)}</span>
        </div>
    );

    const renderContent = () => (
        <div className='ImageClassFilterPopup'>
            <div className='Toolbar'>
                <div className='Stats'>
                    <span>Filtered images: {filteredImagesCount} / {imagesData.length}</span>
                    <span className={isExpressionValid ? 'valid' : 'invalid'}>
                        {isExpressionValid ? 'Expression valid' : 'Expression invalid'}
                    </span>
                </div>
                <button className='ClearButton' type='button' onClick={onClear}>
                    Clear all
                </button>
            </div>

            <div className='ConditionCanvas'>
                <div
                    className='TokenSequence'
                    onDragOver={(event: React.DragEvent) => {
                        if (event.target !== event.currentTarget) {
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(canvasTokens.length);
                    }}
                    onDrop={onDropToCanvasEnd}
                    onDragLeave={() => {
                        if (dragOverIndex === canvasTokens.length) {
                            setDragOverIndex(null);
                        }
                    }}
                >
                    {canvasTokens.map((token: CanvasToken, index: number) => (
                        <React.Fragment key={`fragment-${token.id}`}>
                            {renderCanvasDropSlot(index)}
                            <div
                                className='TokenDropWrapper'
                                onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDragOverIndex(getDropIndexFromPointer(event, index));
                                    event.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(event: React.DragEvent<HTMLDivElement>) =>
                                    onDropAtIndex(event, getDropIndexFromPointer(event, index))
                                }
                            >
                                {renderCanvasToken(token)}
                            </div>
                        </React.Fragment>
                    ))}
                    <div className='CanvasTailDropArea'>
                        {renderCanvasDropSlot(canvasTokens.length)}
                    </div>
                </div>
                {canvasTokens.length === 0 && (
                    <div
                        className='CanvasHint'
                        onDragOver={(event: React.DragEvent) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = 'move';
                            setDragOverIndex(0);
                        }}
                        onDrop={(event: React.DragEvent) => onDropAtIndex(event, 0)}
                    >
                        Drag classes/operators here, or click below to append.
                    </div>
                )}
            </div>

            <div className='LibraryRow'>
                <div className='ClassLibrary'>
                    <div className='LibraryHeader'>Filter Items</div>
                    <div className='LibraryBody'>
                        {renderFilterItemLibrary()}
                    </div>
                </div>

                <div className='OperatorLibrary'>
                    <div className='LibraryHeader'>Logical Condition</div>
                    <div className='TokenBank operators'>
                        {OPERATOR_LIBRARY.map((token: ImageClassExpressionCriteria, index: number) => (
                            <button
                                key={`${token.type}-${index}`}
                                type='button'
                                className='LibraryToken operator'
                                onClick={() => appendToken(token)}
                                draggable={true}
                                onDragStart={(event: React.DragEvent) =>
                                    onDragStart(event, {
                                        source: 'palette',
                                        token,
                                    })
                                }
                            >
                                {getTokenLabel(token as CanvasToken)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <GenericYesNoPopup
            title={'Labels Filter'}
            renderContent={renderContent}
            acceptLabel={'Apply'}
            onAccept={onAccept}
            rejectLabel={'Cancel'}
            onReject={onReject}
            disableAcceptButton={!isExpressionValid}
            disabledTooltip={'Fix the expression before applying the filter.'}
            popupClassName={'ImageClassFilterPopupDialog'}
        />
    );
};

const mapStateToProps = (state: AppState) => ({
    labels: state.labels.labels,
    imagesData: state.labels.imagesData,
    activeLabelType: state.labels.activeLabelType,
    filterMode: state.general.imageListFilterMode,
    searchText: state.general.imageListSearchText,
    keepLabeledInUnlabeled: state.general.keepLabeledInUnlabeled,
    keptUnlabeledImageIds: state.general.keptUnlabeledImageIds,
    imageClassCriteria: state.general.imageClassCriteria,
});

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType,
    updateImageClassCriteriaAction: updateImageClassCriteria,
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImageClassFilterPopup);
