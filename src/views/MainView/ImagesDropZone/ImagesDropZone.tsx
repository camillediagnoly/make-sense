import React, {PropsWithChildren, useRef, useState} from 'react';
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

const ImagesDropZone: React.FC<IProps> = (props: PropsWithChildren<IProps>) => {
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
                setSelectedFiles(sortImageSelections(files));
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
                    selection.directoryId
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
            <div {...getRootProps({
                className: 'DropZone',
                onClick: supportsFilePicker ? handleBrowseClick : undefined,
                onDrop: captureDroppedFileSystemSelections,
            })}>
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
