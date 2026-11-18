import React from 'react';
import './PopupView.scss';
import { PopupWindowType } from '../../data/enums/PopupWindowType';
import { AppState } from '../../store';
import { connect } from 'react-redux';
import ExitProjectPopup from './ExitProjectPopup/ExitProjectPopup';
import ChooseSaveFolderPopup from './ChooseSaveFolderPopup/ChooseSaveFolderPopup';
import { CSSHelper } from '../../logic/helpers/CSSHelper';
import { ClipLoader } from 'react-spinners';

interface IProps {
    activePopupType: PopupWindowType;
}

const PopupView: React.FC<IProps> = ({ activePopupType }) => {

    const selectPopup = () => {
        // The review mode only asks before opening another folder, and where to save
        switch (activePopupType) {
            case PopupWindowType.EXIT_PROJECT:
                return <ExitProjectPopup />;
            case PopupWindowType.CHOOSE_SAVE_FOLDER:
                return <ChooseSaveFolderPopup />;
            case PopupWindowType.LOADER:
                return <ClipLoader
                    size={50}
                    color={CSSHelper.getLeadingColor()}
                    loading={true}
                />;
            default:
                return null;
        }
    };

    return (
        activePopupType && <div className='PopupView'>
            {selectPopup()}
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    activePopupType: state.general.activePopupType
});

export default connect(
    mapStateToProps
)(PopupView);
