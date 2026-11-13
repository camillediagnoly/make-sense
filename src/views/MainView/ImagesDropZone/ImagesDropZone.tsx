import React, {PropsWithChildren, useRef} from 'react';
import './ImagesDropZone.scss';
import {useDropzone, DropzoneOptions} from 'react-dropzone';
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
    const droppedFileSystemSelections = useRef<Promise<LocalFileSelection[]> | null>(null);
    const supportsFilePicker = FileSystemAccessUtil.supportsFilePicker();

    // Only object detection is used: the editor starts as soon as images are dropped or picked
    const startEditor = (selectedFiles: LocalFileSelection[]) => {
        if (selectedFiles.length === 0) {
            return;
        }
        const files = sortImageSelections(selectedFiles);
        props.updateProjectDataAction({
            ...props.projectData,
            type: ProjectType.OBJECT_DETECTION
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
    };

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
                    startEditor(filesFromHandles);
                    return;
                }
            } catch (error) {
                console.warn('Could not read the dropped folder handle. Loading extracted files instead.', error);
            }
        }

        startEditor(acceptedFiles.map((file: File) => ({ file })));
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
            startEditor(await FileSystemAccessUtil.showOpenImageFilePicker());
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error selecting image files:', error);
            }
        }
    };

    return(
        <div className='ImagesDropZone'>
            <div {...getRootProps({
                className: 'DropZone',
                onClick: supportsFilePicker ? handleBrowseClick : undefined,
                onDrop: captureDroppedFileSystemSelections,
            })}>
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
