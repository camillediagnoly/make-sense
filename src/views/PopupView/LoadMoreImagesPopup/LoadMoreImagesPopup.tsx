import React, { useRef, useState } from 'react';
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

const LoadMoreImagesPopup: React.FC<IProps> = ({ addImageData }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<LocalFileSelection[]>([]);
    const droppedFileSystemSelections = useRef<Promise<LocalFileSelection[]> | null>(null);
    const supportsFilePicker = FileSystemAccessUtil.supportsFilePicker();

    const captureDroppedFileSystemSelections = (event: any) => {
        const droppedItems = event?.dataTransfer?.items;
        droppedFileSystemSelections.current = droppedItems
            ? FileSystemAccessUtil.getImageFilesFromDataTransferItems(droppedItems)
            : null;
    };

    const handleDrop = async (acceptedFiles: File[]) => {
        const fileSystemSelections = droppedFileSystemSelections.current;
        droppedFileSystemSelections.current = null;

        if (fileSystemSelections) {
            try {
                const filesFromHandles = await fileSystemSelections;
                if (filesFromHandles.length > 0
                    && (acceptedFiles.length === 0 || filesFromHandles.length >= acceptedFiles.length)) {
                    setSelectedFiles(sortImageSelections(filesFromHandles));
                    return;
                }
            } catch (error) {
                console.warn('Could not read the dropped folder handle. Loading extracted files instead.', error);
            }
        }

        const selectedFilesFromDrop = acceptedFiles.map((file: File) => ({ file }));
        setSelectedFiles(sortImageSelections(selectedFilesFromDrop));
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
                setSelectedFiles(sortImageSelections(files));
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
                    selection.directoryId
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
                <p className='extraBold'>Drop your folder</p>
                <p>or</p>
                <p className='extraBold'>Drop your images</p>
                <p>or</p>
                <p className='extraBold'>Click here to select your images</p>
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
            <div {...getRootProps({
                className: 'DropZone',
                onClick: supportsFilePicker ? handleBrowseClick : undefined,
                onDrop: captureDroppedFileSystemSelections,
            })}>
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
