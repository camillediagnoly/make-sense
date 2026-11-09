import React from 'react';
import './ExitProjectPopup.scss';
import { GenericYesNoPopup } from "../GenericYesNoPopup/GenericYesNoPopup";
import { PopupActions } from "../../../logic/actions/PopupActions";
import { ReviewActions } from "../../../logic/review/ReviewActions";

const ExitProjectPopup: React.FC = () => {
    const renderContent = () => {
        return (
            <div className="ExitProjectPopupContent">
                <div className="Message">
                    Do you want to load a new folder? The changes made to this folder since its last export will be lost.
                </div>
            </div>
        );
    };

    const onAccept = () => {
        PopupActions.close();
        ReviewActions.closeProject();
    };

    const onReject = () => {
        PopupActions.close();
    };

    return (
        <GenericYesNoPopup
            title={"Import new folder"}
            renderContent={renderContent}
            acceptLabel={"Load new folder"}
            onAccept={onAccept}
            rejectLabel={"Back"}
            onReject={onReject}
        />);
};

export default ExitProjectPopup;
