import React, { useState } from 'react';
import classNames from 'classnames';
import { useDropzone } from 'react-dropzone';
import { ClipLoader } from 'react-spinners';
import './AnnotationsMenu.scss';
import { LabelType } from '../../../../data/enums/LabelType';
import {
    AnnotationImportActions,
    ImportableLabelType
} from '../../../../logic/actions/AnnotationImportActions';
import { AnnotationExportActions } from '../../../../logic/actions/AnnotationExportActions';
import { AppState } from '../../../../store';
import { connect } from 'react-redux';

const ACCEPTED_FILES_BY_LABEL_TYPE: Record<ImportableLabelType, Record<string, string[]>> = {
    [LabelType.POLYGON]: {
        'application/json': ['.json']
    },
    [LabelType.RECT]: {
        'application/json': ['.json'],
        'application/xml': ['.xml'],
        'text/plain': ['.txt']
    }
};

const IMPORT_TOOLTIPS: Record<ImportableLabelType, string> = {
    [LabelType.POLYGON]: 'Drop a COCO JSON file here, or click to pick it',
    [LabelType.RECT]: 'Drop VOC XML files, a COCO JSON file or YOLO files with their labels.txt here, ' +
        'or click to pick them'
};

interface IImportDropFieldProps {
    labelType: ImportableLabelType;
}

// Takes the annotation files dropped on it, or picked from the file dialog it opens when clicked,
// and finds out their format by itself.
const ImportDropField: React.FC<IImportDropFieldProps> = ({ labelType }) => {
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
        accept: ACCEPTED_FILES_BY_LABEL_TYPE[labelType],
        multiple: labelType === LabelType.RECT,
        disabled: isImporting,
        onDrop
    });

    const typeName = AnnotationImportActions.getLabelTypeName(labelType);
    return <div
        {...getRootProps({
            className: classNames('AnnotationsMenuItem', 'ImportDropField', {
                'dragActive': isDragActive,
                'disabled': isImporting
            }),
            title: IMPORT_TOOLTIPS[labelType]
        })}
    >
        <input {...getInputProps()} />
        {isImporting ?
            <ClipLoader size={13} color={'white'} loading={true}/> :
            <img draggable={false} src={'ico/import-labels.png'} alt={'import'}/>}
        {isImporting ? `Importing ${typeName}` : `Import ${typeName}`}
    </div>;
};

interface IAnnotationsMenuProps {
    exportedLabelType: ImportableLabelType;
}

interface IExportButtonProps {
    labelType: ImportableLabelType;
}

// Exports the type the project works with, in the format matching it
const ExportButton: React.FC<IExportButtonProps> = ({ labelType }) => {
    const isPolygon = labelType === LabelType.POLYGON;
    return <div
        className='AnnotationsMenuItem ExportButton'
        onClick={() => AnnotationExportActions.exportAnnotations()}
        title={isPolygon ? 'Export the polygons to a COCO JSON file' : 'Export the rectangles to VOC XML files'}
    >
        <img draggable={false} src={'ico/export-labels.png'} alt={'export'}/>
        Export
    </div>;
};

const AnnotationsMenu: React.FC<IAnnotationsMenuProps> = ({ exportedLabelType }) => {
    return <div className='AnnotationsMenu'>
        <ImportDropField labelType={LabelType.POLYGON}/>
        <ImportDropField labelType={LabelType.RECT}/>
        <div className='AnnotationsMenuSeparator'/>
        <ExportButton labelType={exportedLabelType}/>
    </div>;
};

const mapStateToProps = (state: AppState) => ({
    exportedLabelType: AnnotationExportActions.resolveExportedLabelType(
        state.labels.annotationMode,
        state.labels.activeLabelType
    )
});

export default connect(mapStateToProps)(AnnotationsMenu);
