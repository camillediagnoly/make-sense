import React, { useState } from 'react';
import classNames from 'classnames';
import { useDropzone } from 'react-dropzone';
import { ClipLoader } from 'react-spinners';
import './AnnotationImportDropZone.scss';
import { LabelType } from '../../../../data/enums/LabelType';
import {
    AnnotationImportActions,
    ImportableLabelType
} from '../../../../logic/actions/AnnotationImportActions';
import {
    ACCEPTED_ANNOTATION_FILES_BY_LABEL_TYPE,
    ANNOTATION_IMPORT_TOOLTIPS
} from '../../../../data/info/AnnotationImportFileData';

interface IProps {
    labelType: ImportableLabelType;
}

// Fills the labels list of an image that has none yet: annotation files dropped on it, or picked
// from the file dialog it opens when clicked, are imported like from the menu bar import fields.
const AnnotationImportDropZone: React.FC<IProps> = ({ labelType }) => {
    const [isImporting, setIsImporting] = useState(false);

    const onDrop = async (acceptedFiles: File[]) => {
        setIsImporting(true);
        try {
            await AnnotationImportActions.importFiles(acceptedFiles, labelType);
        } finally {
            setIsImporting(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: ACCEPTED_ANNOTATION_FILES_BY_LABEL_TYPE[labelType],
        multiple: labelType === LabelType.RECT,
        disabled: isImporting,
        onDrop
    });

    const isPolygon = labelType === LabelType.POLYGON;
    const typeName = AnnotationImportActions.getLabelTypeName(labelType);
    return <div
        {...getRootProps({
            className: classNames('AnnotationImportDropZone', {
                'dragActive': isDragActive,
                'disabled': isImporting
            }),
            title: ANNOTATION_IMPORT_TOOLTIPS[labelType]
        })}
    >
        <input {...getInputProps()} />
        {isImporting ?
            <ClipLoader size={30} color={'white'} loading={true}/> :
            <img draggable={false} src={'ico/import-labels.png'} alt={'import'}/>}
        <p className='extraBold'>
            {isImporting ? `Importing ${typeName}` : `Drop ${typeName} here`}
        </p>
        {!isImporting && <p>
            {isPolygon ? 'a COCO JSON file' : 'VOC XML, COCO JSON or YOLO files'}, or click to pick
        </p>}
        {!isImporting && <p className='hint'>
            {`or draw your first ${isPolygon ? 'polygon' : 'bounding box'} on the image`}
        </p>}
    </div>;
};

export default AnnotationImportDropZone;
