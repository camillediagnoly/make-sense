import React from 'react';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { AnnotationImportActions } from '../../../logic/actions/AnnotationImportActions';
import './ImportAnnotationsConfirmPopup.scss';

// Opened by the import fields of the menu bar when the project already holds annotations
const ImportAnnotationsConfirmPopup: React.FC = () => {
    const pendingImport = AnnotationImportActions.getPendingImport();
    const typeName = pendingImport
        ? AnnotationImportActions.getLabelTypeName(pendingImport.labelType)
        : 'annotations';

    const onKeep = () => {
        PopupActions.close();
        AnnotationImportActions.applyPendingImport(true);
    };

    const onReplace = () => {
        PopupActions.close();
        AnnotationImportActions.applyPendingImport(false);
    };

    const onCancel = () => {
        AnnotationImportActions.discardPendingImport();
        PopupActions.close();
    };

    const renderContent = () => (
        <div className='ImportAnnotationsConfirmPopupContent'>
            <div className='Message'>
                Your project already has annotations. The imported {typeName} can be added to them, or
                replace them.
            </div>
            <div className='Warning'>
                Replacing removes every current annotation, of any type, on the images the files describe
                and on the others.
            </div>
            {pendingImport && pendingImport.failedFileNames.length > 0 && <div className='FailedFiles'>
                <p className='extraBold'>These files could not be read and will be skipped</p>
                {pendingImport.failedFileNames.map((fileName: string) => <p key={fileName}>{fileName}</p>)}
            </div>}
        </div>
    );

    return (
        <GenericYesNoPopup
            title={`Import ${typeName}`}
            renderContent={renderContent}
            acceptLabel='Add to current'
            onAccept={onKeep}
            disableAcceptButton={!pendingImport}
            extraActionLabel={pendingImport ? 'Replace current' : undefined}
            onExtraAction={pendingImport ? onReplace : undefined}
            extraActionButtonClassName='danger'
            rejectLabel='Cancel'
            onReject={onCancel}
            popupClassName='ImportAnnotationsConfirmPopupDialog'
        />
    );
};

export default ImportAnnotationsConfirmPopup;
