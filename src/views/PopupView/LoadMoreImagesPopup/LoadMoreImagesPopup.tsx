import React, { useState } from 'react';
import './LoadMoreImagesPopup.scss';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { addImageData } from '../../../store/labels/actionCreators';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { DropzoneOptions, useDropzone } from 'react-dropzone';
import { ImageData } from '../../../store/labels/types';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { ImageDataUtil } from '../../../utils/ImageDataUtil';
import { StyledTextField } from '../../Common/StyledTextField/StyledTextField';
import { DEFAULT_IMAGE_GROUP_NAME } from '../../../utils/ImageGroupUtil';
import { LocalFileSelection } from '../../../interfaces/IFileSystemAccess';
import { FileSystemAccessUtil } from '../../../utils/FileSystemAccessUtil';

interface IProps {
    addImageData: (imageData: ImageData[]) => any;
}

const acceptedImageTypes = {
    'image/*': ['.jpg', '.jpeg', '.png']
};

function naturalSort(a: LocalFileSelection, b: LocalFileSelection) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return collator.compare(a.file.name, b.file.name);
}

const sortImageSelections = (items: LocalFileSelection[]): LocalFileSelection[] => {
    return [...items].sort(naturalSort);
};

const requestFolderAccessAfterMessage = async (
    selections: LocalFileSelection[]
): Promise<LocalFileSelection[]> => {
    const selectionsWithStoredFolderAccess = await FileSystemAccessUtil
        .attachStoredDirectoryAccessToSelections(selections);

    if (!FileSystemAccessUtil.needsDirectoryAccess(selectionsWithStoredFolderAccess)) {
        return selectionsWithStoredFolderAccess;
    }

    window.alert(
        'To enable local deletion, select the folder that contains the selected images in the next window.'
    );
    return FileSystemAccessUtil.attachDirectoryAccessToSelections(selectionsWithStoredFolderAccess);
};

const LoadMoreImagesPopup: React.FC<IProps> = ({ addImageData }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<LocalFileSelection[]>([]);
    const supportsFilePicker = FileSystemAccessUtil.supportsFilePicker();

    const handleDrop = async (acceptedFiles: File[], _fileRejections: any[], event: any) => {
        const droppedItems = event?.dataTransfer?.items;

        if (droppedItems) {
            const filesFromHandles = await FileSystemAccessUtil.getImageFilesFromDataTransferItems(droppedItems);
            if (filesFromHandles.length > 0) {
                const filesWithFolderAccess = await requestFolderAccessAfterMessage(filesFromHandles);
                setSelectedFiles(sortImageSelections(filesWithFolderAccess));
                return;
            }
        }

        const selectedFilesFromDrop = acceptedFiles.map((file: File) => ({ file }));
        const filesWithFolderAccess = await requestFolderAccessAfterMessage(selectedFilesFromDrop);
        setSelectedFiles(sortImageSelections(filesWithFolderAccess));
    };

    const { getRootProps, getInputProps } = useDropzone({
        accept: acceptedImageTypes,
        noClick: supportsFilePicker,
        onDrop: handleDrop,
    } as DropzoneOptions);

    const handleBrowseClick = async () => {
        if (!supportsFilePicker) {
            return;
        }

        try {
            const files = await FileSystemAccessUtil.showOpenImageFilePicker();
            if (files.length > 0) {
                const filesWithFolderAccess = await requestFolderAccessAfterMessage(files);
                setSelectedFiles(sortImageSelections(filesWithFolderAccess));
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error selecting image files:', error);
            }
        }
    };

    const onAccept = () => {
        if (selectedFiles.length > 0) {
            addImageData(sortImageSelections(selectedFiles).map((selection: LocalFileSelection) =>
                ImageDataUtil.createImageDataFromFileData(
                    selection.file,
                    groupName,
                    selection.fileHandle,
                    selection.directoryHandle,
                    selection.directoryImageFileNames
                )
            ));
            PopupActions.close();
        }
    };

    const onReject = () => {
        PopupActions.close();
    };

    const getDropZoneContent = () => {
        if (selectedFiles.length === 0)
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={'upload'}
                    src={'ico/box-opened.png'}
                />
                <p className='extraBold'>Add new images</p>
                <p>or</p>
                <p className='extraBold'>Click here to select them</p>
            </>;
        else if (selectedFiles.length === 1)
            return <>
                <img
                    draggable={false}
                    alt={'uploaded'}
                    src={'ico/box-closed.png'}
                />
                <p className='extraBold'>1 new image loaded</p>
            </>;
        else
            return <>
                <img
                    draggable={false}
                    key={1}
                    alt={'uploaded'}
                    src={'ico/box-closed.png'}
                />
                <p key={2} className='extraBold'>{selectedFiles.length} new images loaded</p>
            </>;
    };

    const renderContent = () => {
        return (<div className='LoadMoreImagesPopupContent'>
            <div {...getRootProps({ className: 'DropZone', onClick: supportsFilePicker ? handleBrowseClick : undefined })}>
                {getDropZoneContent()}
            </div>
            <div className='GroupInput'>
                <StyledTextField
                    variant='standard'
                    id={'load-more-images-group-name'}
                    autoComplete={'off'}
                    type={'text'}
                    margin={'dense'}
                    label={'Image group (optional)'}
                    value={groupName}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setGroupName(event.target.value)}
                    style={{ width: 320 }}
                    InputLabelProps={{ shrink: true }}
                />
                <p>
                    Leave empty to keep these images in <span>{DEFAULT_IMAGE_GROUP_NAME}</span>.
                </p>
            </div>
        </div>);
    };

    return (
        <GenericYesNoPopup
            title={'Load more images'}
            renderContent={renderContent}
            acceptLabel={'Load'}
            disableAcceptButton={selectedFiles.length < 1}
            onAccept={onAccept}
            rejectLabel={'Cancel'}
            onReject={onReject}
        />
    );
};

const mapDispatchToProps = {
    addImageData
};

const mapStateToProps = (state: AppState) => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoadMoreImagesPopup);
