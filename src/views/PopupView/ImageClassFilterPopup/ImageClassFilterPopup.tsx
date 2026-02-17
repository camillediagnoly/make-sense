import React, { useEffect, useMemo, useState } from 'react';
import './ImageClassFilterPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { connect } from 'react-redux';
import { AppState } from '../../../store';
import { LabelName } from '../../../store/labels/types';
import {
    ImageClassCriteria,
    ImageClassCriteriaMode,
    ImageClassCriteriaOperator,
} from '../../../store/general/types';
import {
    updateActivePopupType,
    updateImageClassCriteria,
} from '../../../store/general/actionCreators';
import Scrollbars from 'react-custom-scrollbars-2';
import { ImageFilterMode } from '../../../data/enums/ImageFilterMode';
import { ImageData } from '../../../store/labels/types';
import { LabelType } from '../../../data/enums/LabelType';
import { ImageFilterUtil } from '../../../utils/ImageFilterUtil';

type CriteriaRow = {
    labelId: string;
    labelName: string;
    enabled: boolean;
    mode: ImageClassCriteriaMode;
    operator: ImageClassCriteriaOperator;
}

interface IProps {
    labels: LabelName[];
    imagesData: ImageData[];
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    imageClassCriteria: ImageClassCriteria[];
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    updateImageClassCriteriaAction: (criteria: ImageClassCriteria[]) => any;
}

const buildRows = (
    labels: LabelName[],
    imageClassCriteria: ImageClassCriteria[]
): CriteriaRow[] => {
    const criteriaMap = new Map<string, ImageClassCriteria>();
    imageClassCriteria.forEach((criteria: ImageClassCriteria) =>
        criteriaMap.set(criteria.labelId, criteria)
    );

    return labels.map((label: LabelName) => {
            const rowCriteria = criteriaMap.get(label.id);
            return {
                labelId: label.id,
                labelName: label.name,
                enabled: !!rowCriteria,
                mode: rowCriteria?.mode ?? 'include',
                operator: rowCriteria?.operator ?? 'and',
            };
        });
};

const ImageClassFilterPopup: React.FC<IProps> = (
    {
        labels,
        imagesData,
        activeLabelType,
        filterMode,
        searchText,
        imageClassCriteria,
        updateActivePopupTypeAction,
        updateImageClassCriteriaAction,
    }
) => {
    const [rows, setRows] = useState<CriteriaRow[]>(
        buildRows(labels, imageClassCriteria)
    );

    useEffect(() => {
        setRows(buildRows(labels, imageClassCriteria));
    }, [labels, imageClassCriteria]);

    const activeRows = useMemo(
        () => rows.filter((row: CriteriaRow) => row.enabled),
        [rows]
    );

    const updateRow = (labelId: string, patch: Partial<CriteriaRow>) => {
        setRows((prevRows: CriteriaRow[]) =>
            prevRows.map((row: CriteriaRow) =>
                row.labelId === labelId ? { ...row, ...patch } : row
            )
        );
    };

    const onSetMode = (labelId: string, mode: ImageClassCriteriaMode) => {
        setRows((prevRows: CriteriaRow[]) =>
            prevRows.map((row: CriteriaRow) => {
                if (row.labelId !== labelId) {
                    return row;
                }

                const shouldDisable = row.enabled && row.mode === mode;
                if (shouldDisable) {
                    return {
                        ...row,
                        enabled: false,
                        mode: 'include',
                        operator: 'and',
                    };
                }

                return { ...row, mode, enabled: true };
            })
        );
    };

    const onSetOperator = (
        labelId: string,
        operator: ImageClassCriteriaOperator
    ) => {
        updateRow(labelId, { operator, enabled: true });
    };

    const onAccept = () => {
        const normalizedCriteria: ImageClassCriteria[] = rows
            .filter((row: CriteriaRow) => row.enabled)
            .map((row: CriteriaRow) => ({
                labelId: row.labelId,
                mode: row.mode,
                operator: row.operator,
            }));
        updateImageClassCriteriaAction(normalizedCriteria);
        updateActivePopupTypeAction(null);
    };

    const onReject = () => {
        updateActivePopupTypeAction(null);
    };

    const onClear = () => {
        setRows((prevRows: CriteriaRow[]) =>
            prevRows.map((row: CriteriaRow) => ({
                ...row,
                enabled: false,
                mode: 'include',
                operator: 'and',
            }))
        );
    };

    const draftCriteria: ImageClassCriteria[] = useMemo(
        () =>
            rows
                .filter((row: CriteriaRow) => row.enabled)
                .map((row: CriteriaRow) => ({
                    labelId: row.labelId,
                    mode: row.mode,
                    operator: row.operator,
                })),
        [rows]
    );

    const filteredImagesCount = useMemo(
        () =>
            ImageFilterUtil.getFilteredImageIndices(
                imagesData,
                activeLabelType,
                filterMode,
                searchText,
                draftCriteria
            ).length,
        [imagesData, activeLabelType, filterMode, searchText, draftCriteria]
    );

    const renderRows = () => {
        if (rows.length === 0) {
            return <div className='EmptyState'>No labels found. Add labels first.</div>;
        }

        return rows.map((row: CriteriaRow) => {
            return (
                <div className={`CriteriaRow ${row.enabled ? 'enabled' : ''}`} key={row.labelId}>
                    <div className='CriteriaCell label'>{row.labelName}</div>
                    <div className='CriteriaCell mode'>
                        <button
                            className={`ToggleButton include ${row.enabled && row.mode === 'include' ? 'active' : ''}`}
                            type='button'
                            onClick={() => onSetMode(row.labelId, 'include')}
                        >
                            Include
                        </button>
                        <button
                            className={`ToggleButton exclude ${row.enabled && row.mode === 'exclude' ? 'active' : ''}`}
                            type='button'
                            onClick={() => onSetMode(row.labelId, 'exclude')}
                        >
                            Exclude
                        </button>
                    </div>
                    <div className='CriteriaCell operator'>
                        <button
                            className={`ToggleButton and ${row.enabled && row.operator === 'and' ? 'active' : ''}`}
                            type='button'
                            onClick={() => onSetOperator(row.labelId, 'and')}
                        >
                            AND
                        </button>
                        <button
                            className={`ToggleButton or ${row.enabled && row.operator === 'or' ? 'active' : ''}`}
                            type='button'
                            onClick={() => onSetOperator(row.labelId, 'or')}
                        >
                            OR
                        </button>
                    </div>
                </div>
            );
        });
    };

    const renderContent = () => (
        <div className='ImageClassFilterPopup'>
            <div className='Toolbar'>
                <div className='Stats'>
                    <span>Active conditions: {activeRows.length}</span>
                    <span>Filtered images: {filteredImagesCount} / {imagesData.length}</span>
                </div>
                <button className='ClearButton' type='button' onClick={onClear}>
                    Clear all
                </button>
            </div>
            <div className='HeaderRow'>
                <div className='CriteriaCell label'>Label</div>
                <div className='CriteriaCell mode'>Type</div>
                <div className='CriteriaCell operator'>Join</div>
            </div>
            <div className='RowsContainer'>
                <Scrollbars autoHide={true}>
                    <div className='RowsContent'>
                        {renderRows()}
                    </div>
                </Scrollbars>
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
