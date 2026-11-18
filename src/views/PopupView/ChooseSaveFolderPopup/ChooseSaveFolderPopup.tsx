import React, { useState } from 'react';
import '../ExitProjectPopup/ExitProjectPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { ReviewActions } from '../../../logic/review/ReviewActions';
import { ReviewProject } from '../../../logic/review/ReviewProject';

// Shown when "Save my review" is clicked but the browser does not know the folder of the
// annotations: the "images" folder and the .json file were dropped instead of their folder
const ChooseSaveFolderPopup: React.FC = () => {
    const [problem, setProblem] = useState<string | null>(null);
    const annotationsName = ReviewProject.getLoadedAnnotationsName();

    const chooseFolder = async () => {
        setProblem(null);
        const choice = await ReviewActions.chooseSaveFolder();
        if (choice.chosen === false) {
            setProblem(choice.problem);
            return;
        }
        PopupActions.close();
        await ReviewActions.exportCurrentFolder();
    };

    const download = async () => {
        PopupActions.close();
        await ReviewActions.exportCurrentFolder();
    };

    const renderContent = () => <div className='ReviewPopupContent'>
        <p>To save your review next to <b>&quot;{annotationsName}&quot;</b>, please choose the folder that holds it.</p>
        <p>You will only be asked once.</p>
        {problem && <p className='Problem'>{problem}</p>}
    </div>;

    return <GenericYesNoPopup
        title={'Where should your review be saved?'}
        renderContent={renderContent}
        acceptLabel={'Choose the folder'}
        onAccept={chooseFolder}
        extraActionLabel={'Download instead'}
        onExtraAction={download}
        rejectLabel={'Back'}
        onReject={PopupActions.close}
        popupClassName={'ReviewPopup'}
    />;
};

export default ChooseSaveFolderPopup;
