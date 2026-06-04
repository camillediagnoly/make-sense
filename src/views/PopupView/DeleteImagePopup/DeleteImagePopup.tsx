import React from 'react';
import { connect } from 'react-redux';
import { ImageActions } from '../../../logic/actions/ImageActions';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { AppState } from '../../../store';
import { ImageData } from '../../../store/labels/types';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import './DeleteImagePopup.scss';

interface IProps {
    activeImageData: ImageData | null;
}

const DeleteImagePopup: React.FC<IProps> = ({ activeImageData }) => {
    const onAccept = async () => {
        PopupActions.close();
        await ImageActions.deleteImage(activeImageData);
    };

    const renderContent = () => (
        <div className='DeleteImagePopupContent'>
            <div className='Warning'>
                This image will be permanently deleted from disk:
            </div>
            <div className='FileName'>
                {activeImageData?.fileData.name}
            </div>
        </div>
    );

    return (
        <GenericYesNoPopup
            title='Delete image'
            renderContent={renderContent}
            acceptLabel='Delete image'
            onAccept={onAccept}
            rejectLabel='Cancel'
            onReject={PopupActions.close}
            disableAcceptButton={!activeImageData}
            popupClassName='DeleteImagePopupDialog'
        />
    );
};

const mapStateToProps = (state: AppState) => ({
    activeImageData: state.labels.activeImageIndex === null
        ? null
        : state.labels.imagesData[state.labels.activeImageIndex],
});

export default connect(mapStateToProps)(DeleteImagePopup);
