import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import './TopNavigationBar.scss';
import EditorTools from '../EditorTools/EditorTools';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateActivePopupType } from '../../../store/general/actionCreators';
import { ProjectData } from '../../../store/general/types';
import { ImageData } from '../../../store/labels/types';
import { ReviewActions } from '../../../logic/review/ReviewActions';
import { ReviewSaveState } from '../../../logic/review/ReviewSaveState';

interface IProps {
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    projectData: ProjectData;
    imagesData: ImageData[];
}

const formatTime = (date: Date): string =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const TopNavigationBar: React.FC<IProps> = ({ updateActivePopupTypeAction, projectData, imagesData }) => {
    const [isSaving, setIsSaving] = useState(false);
    // Saving does not change the store: re-render when the saved state changes
    const [, setSaveStateVersion] = useState(0);
    useEffect(() => ReviewSaveState.subscribe(() => setSaveStateVersion((version: number) => version + 1)), []);

    const hasUnsavedChanges = ReviewSaveState.hasUnsavedChanges(imagesData);
    const lastSavedAt = ReviewSaveState.getLastSavedAt();

    const onOpenClick = () => updateActivePopupTypeAction(PopupWindowType.EXIT_PROJECT);

    const onSaveClick = async () => {
        if (isSaving) {
            return;
        }
        setIsSaving(true);
        try {
            await ReviewActions.onSaveClick();
        } finally {
            setIsSaving(false);
        }
    };

    const renderSaveStatus = () => {
        if (hasUnsavedChanges) {
            return <div className='SaveStatus unsaved'>● Not saved yet</div>;
        }
        if (lastSavedAt) {
            return <div className='SaveStatus saved'>✓ Saved at {formatTime(lastSavedAt)}</div>;
        }
        return <div className='SaveStatus'>No changes yet</div>;
    };

    return (
        <div className='TopNavigationBar'>
            <div className='TopNavigationBarWrapper'>
                <div className='NavigationBarGroupWrapper'>
                    <div className='NavigationBarButton' onClick={onOpenClick}>
                        <img draggable={false} alt={''} src={'ico/import-labels.png'}/>
                        Open another folder
                    </div>
                    <div
                        className={classNames('NavigationBarButton', 'SaveButton', {
                            disabled: isSaving,
                            highlighted: hasUnsavedChanges,
                        })}
                        onClick={onSaveClick}
                    >
                        <img draggable={false} alt={''} src={'ico/export-labels.png'}/>
                        {isSaving ? 'Saving…' : 'Save my review'}
                    </div>
                    {renderSaveStatus()}
                </div>
                <div className='NavigationBarGroupWrapper'>
                    <EditorTools/>
                </div>
                <div className='NavigationBarGroupWrapper middle'>
                    <div className='ProjectName' title={projectData.name}>{projectData.name}</div>
                </div>
            </div>
        </div>
    );
};

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType,
};

const mapStateToProps = (state: AppState) => ({
    projectData: state.general.projectData,
    imagesData: state.labels.imagesData,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TopNavigationBar);
