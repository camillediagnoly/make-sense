import React, { useState } from 'react';
import './ExitProjectPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { ReviewActions } from '../../../logic/review/ReviewActions';
import { ReviewProject } from '../../../logic/review/ReviewProject';
import { ReviewSaveState } from '../../../logic/review/ReviewSaveState';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';

const ExitProjectPopup: React.FC = () => {
    const [hasUnsavedChanges] = useState(() => ReviewSaveState.hasUnsavedChanges(LabelsSelector.getImagesData()));
    const [isSaving, setIsSaving] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const needsSaveFolder = ReviewProject.needsSaveFolder();

    const openAnotherFolder = () => {
        PopupActions.close();
        ReviewActions.closeProject();
    };

    const saveThenOpen = async () => {
        if (isSaving) {
            return;
        }
        setProblem(null);
        if (needsSaveFolder) {
            // The folder picker has to open right from the click, before anything else is awaited
            const choice = await ReviewActions.chooseSaveFolder();
            if (choice.chosen === false) {
                setProblem(choice.problem);
                return;
            }
        }
        setIsSaving(true);
        const isSaved = await ReviewActions.exportCurrentFolder();
        setIsSaving(false);
        if (isSaved) {
            openAnotherFolder();
        } else {
            setProblem('Your review could not be saved: see the message at the bottom right.');
        }
    };

    const renderContent = () => <div className='ReviewPopupContent'>
        {hasUnsavedChanges ? <>
            <p>Your review has changes that are <b>not saved yet</b>.</p>
            <p>
                Do you want to save them before opening another folder?
                {needsSaveFolder && ` You will be asked to choose the folder that holds `
                    + `"${ReviewProject.getLoadedAnnotationsName()}".`}
            </p>
        </> : <p>Your review has no unsaved changes. Do you want to open another folder?</p>}
        {problem && <p className='Problem'>{problem}</p>}
    </div>;

    if (!hasUnsavedChanges) {
        return <GenericYesNoPopup
            title={'Open another folder'}
            renderContent={renderContent}
            acceptLabel={'Open another folder'}
            onAccept={openAnotherFolder}
            rejectLabel={'Back'}
            onReject={PopupActions.close}
            popupClassName={'ReviewPopup'}
        />;
    }

    return <GenericYesNoPopup
        title={'Open another folder'}
        renderContent={renderContent}
        acceptLabel={isSaving ? 'Saving…' : 'Save, then open'}
        onAccept={saveThenOpen}
        disableAcceptButton={isSaving}
        extraActionLabel={'Open without saving'}
        onExtraAction={openAnotherFolder}
        rejectLabel={'Back'}
        onReject={PopupActions.close}
        popupClassName={'ReviewPopup'}
    />;
};

export default ExitProjectPopup;
