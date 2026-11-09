import React, { useState } from 'react';
import './TopNavigationBar.scss';
import StateBar from '../StateBar/StateBar';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateActivePopupType } from '../../../store/general/actionCreators';
import { ProjectData } from '../../../store/general/types';
import { ReviewActions } from '../../../logic/review/ReviewActions';

interface IProps {
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    projectData: ProjectData;
}

const TopNavigationBar: React.FC<IProps> = ({ updateActivePopupTypeAction, projectData }) => {
    const [isExporting, setIsExporting] = useState(false);

    const onImportClick = () => updateActivePopupTypeAction(PopupWindowType.EXIT_PROJECT);

    const onExportClick = async () => {
        if (isExporting) {
            return;
        }
        setIsExporting(true);
        try {
            await ReviewActions.exportCurrentFolder();
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className='TopNavigationBar'>
            <StateBar/>
            <div className='TopNavigationBarWrapper'>
                <div className='NavigationBarGroupWrapper'>
                    <div className='NavigationBarButton' onClick={onImportClick}>
                        <img draggable={false} alt={'import'} src={'ico/import-labels.png'}/>
                        Import new folder
                    </div>
                    <div
                        className={`NavigationBarButton${isExporting ? ' disabled' : ''}`}
                        onClick={onExportClick}
                    >
                        <img draggable={false} alt={'export'} src={'ico/export-labels.png'}/>
                        {isExporting ? 'Exporting...' : 'Export current folder'}
                    </div>
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
    projectData: state.general.projectData
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TopNavigationBar);
