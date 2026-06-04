import React, {PropsWithChildren, useState} from 'react';
import './ImagesDropZone.scss';
import {useDropzone, DropzoneOptions} from 'react-dropzone';
import {TextButton} from '../../Common/TextButton/TextButton';
import {ImageData} from '../../../store/labels/types';
import {connect} from 'react-redux';
import {addImageData, updateActiveImageIndex} from '../../../store/labels/actionCreators';
import {AppState} from '../../../store';
import {ProjectType} from '../../../data/enums/ProjectType';
import {PopupWindowType} from '../../../data/enums/PopupWindowType';
import {updateActivePopupType, updateProjectData} from '../../../store/general/actionCreators';
import {ProjectData} from '../../../store/general/types';
import {ImageDataUtil} from '../../../utils/ImageDataUtil';
import {FileSystemAccessUtil} from '../../../utils/FileSystemAccessUtil';
import {LocalFileSelection} from '../../../interfaces/IFileSystemAccess';

interface IProps {
    updateActiveImageIndexAction: (activeImageIndex: number) => any;
    addImageDataAction: (imageData: ImageData[]) => any;
    updateProjectDataAction: (projectData: ProjectData) => any;
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    projectData: ProjectData;
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

const ImagesDropZone: React.FC<IProps> = (props: PropsWithChildren<IProps>) => {
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

    const {getRootProps, getInputProps} = useDropzone({
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

    const startEditor = (projectType: ProjectType) => {
        if (selectedFiles.length > 0) {
            const files = sortImageSelections(selectedFiles);
            props.updateProjectDataAction({
                ...props.projectData,
                type: projectType
            });
            props.updateActiveImageIndexAction(0);
            props.addImageDataAction(files.map((selection: LocalFileSelection) => ImageDataUtil
                .createImageDataFromFileData(
                    selection.file,
                    undefined,
                    selection.fileHandle,
                    selection.directoryHandle,
                    selection.directoryImageFileNames
                )));
            props.updateActivePopupTypeAction(PopupWindowType.INSERT_LABEL_NAMES);
        }
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
                <p className='extraBold'>Drop images</p>
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
                <p className='extraBold'>1 image loaded</p>
            </>;
        else
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    key={1}
                    alt={'uploaded'}
                    src={'ico/box-closed.png'}
                />
                <p key={2} className='extraBold'>{selectedFiles.length} images loaded</p>
            </>;
    };

    const startEditorWithObjectDetection = () => startEditor(ProjectType.OBJECT_DETECTION)
    const startEditorWithImageRecognition = () => startEditor(ProjectType.IMAGE_RECOGNITION)

    return(
        <div className='ImagesDropZone'>
            <div {...getRootProps({className: 'DropZone', onClick: supportsFilePicker ? handleBrowseClick : undefined})}>
                {getDropZoneContent()}
            </div>
            <div className='DropZoneButtons'>
                <TextButton
                    label={'Object Detection'}
                    isDisabled={!selectedFiles.length}
                    onClick={startEditorWithObjectDetection}
                />
                <TextButton
                    label={'Image recognition'}
                    isDisabled={!selectedFiles.length}
                    onClick={startEditorWithImageRecognition}
                />
            </div>
        </div>
    )
};

const mapDispatchToProps = {
    updateActiveImageIndexAction: updateActiveImageIndex,
    addImageDataAction: addImageData,
    updateProjectDataAction: updateProjectData,
    updateActivePopupTypeAction: updateActivePopupType
};

const mapStateToProps = (state: AppState) => ({
    projectData: state.general.projectData
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImagesDropZone);
