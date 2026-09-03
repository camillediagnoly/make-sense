import React, { useState } from 'react';
import './ImportLabelPopup.scss';
import { LabelType } from '../../../data/enums/LabelType';
import { PopupActions } from '../../../logic/actions/PopupActions';
import GenericLabelTypePopup from '../GenericLabelTypePopup/GenericLabelTypePopup';
import { ImportFormatData } from '../../../data/ImportFormatData';
import { FeatureInProgress } from '../../EditorView/FeatureInProgress/FeatureInProgress';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { useDropzone } from 'react-dropzone';
import { ImageData, LabelName } from '../../../store/labels/types';
import { updateActiveLabelType, updateImageData, updateLabelNames } from '../../../store/labels/actionCreators';
import { updateMeasurementFunctions } from '../../../store/general/actionCreators';
import { MeasurementFunctionByName } from '../../../data/measurements/MeasurementFunctionData';
import { ImporterSpecData } from '../../../data/ImporterSpecData';
import { AnnotationFormatType } from '../../../data/enums/AnnotationFormatType';
import { ILabelFormatData } from '../../../interfaces/ILabelFormatData';
import { submitNewNotification } from '../../../store/notifications/actionCreators';
import { NotificationUtil } from '../../../utils/NotificationUtil';
import { NotificationsDataMap } from '../../../data/info/NotificationsData';
import { DocumentParsingError, PartialVOCImportError } from '../../../logic/import/voc/VOCImporter';
import { Notification } from '../../../data/enums/Notification';
import {LabelNamesNotUniqueError} from '../../../logic/import/yolo/YOLOErrors';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { AnnotationMergeUtil } from '../../../utils/AnnotationMergeUtil';
import { ClipLoader } from 'react-spinners';

interface IProps {
    activeLabelType: LabelType,
    updateImageDataAction: (imageData: ImageData[]) => any,
    updateLabelNamesAction: (labels: LabelName[]) => any,
    updateActiveLabelTypeAction: (activeLabelType: LabelType) => any;
    updateMeasurementFunctionsAction: typeof updateMeasurementFunctions;
}

const ImportLabelPopup: React.FC<IProps> = (
    {
        activeLabelType,
        updateImageDataAction,
        updateLabelNamesAction,
        updateActiveLabelTypeAction,
        updateMeasurementFunctionsAction
    }) => {
    const resolveFormatType = (labelType: LabelType): AnnotationFormatType => {
        const possibleImportFormats = ImportFormatData[labelType];
        return possibleImportFormats.length === 1 ? possibleImportFormats[0].type : null;
    };

    const [labelType, setLabelType] = useState(activeLabelType);
    const [formatType, setFormatType] = useState(resolveFormatType(activeLabelType));
    const [loadedLabelNames, setLoadedLabelNames] = useState([]);
    const [loadedImageData, setLoadedImageData] = useState([]);
    const [loadedMeasurementFunctionByName, setLoadedMeasurementFunctionByName] =
        useState<MeasurementFunctionByName>({});
    const [annotationsLoadedError, setAnnotationsLoadedError] = useState(null);
    const [failedAnnotationFiles, setFailedAnnotationFiles] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [keepCurrentAnnotations, setKeepCurrentAnnotations] = useState(false);

    const resolveNotification = (error: Error): Notification => {
        if (error instanceof DocumentParsingError) {
            return Notification.ANNOTATION_FILE_PARSE_ERROR
        }
        if (error instanceof LabelNamesNotUniqueError) {
            return Notification.NON_UNIQUE_LABEL_NAMES_ERROR
        }
        return Notification.ANNOTATION_IMPORT_ASSERTION_ERROR
    }

    const onLabelTypeChange = (type: LabelType) => {
        setLabelType(type);
        setFormatType(resolveFormatType(type));
        setLoadedLabelNames([]);
        setLoadedImageData([]);
        setLoadedMeasurementFunctionByName({});
        setAnnotationsLoadedError(null);
        setFailedAnnotationFiles([]);
        setIsImporting(false);
    };

    const onAnnotationLoadSuccess = (
        imagesData: ImageData[],
        labelNames: LabelName[],
        measurementFunctionByName: MeasurementFunctionByName = {},
    ) => {
        setLoadedLabelNames(labelNames);
        setLoadedImageData(imagesData);
        setLoadedMeasurementFunctionByName(measurementFunctionByName);
        setAnnotationsLoadedError(null);
        setFailedAnnotationFiles([]);
        setIsImporting(false);
    };

    const onAnnotationsLoadFailure = (error?: Error) => {
        if (error instanceof PartialVOCImportError) {
            setLoadedLabelNames(error.labelNames);
            setLoadedImageData(error.imagesData);
            setLoadedMeasurementFunctionByName({});
            setAnnotationsLoadedError(null);
            setFailedAnnotationFiles(error.fileNames);
            setIsImporting(false);
            return;
        }

        setLoadedLabelNames([]);
        setLoadedImageData([]);
        setLoadedMeasurementFunctionByName({});
        setAnnotationsLoadedError(error);
        setFailedAnnotationFiles([]);
        setIsImporting(false);
        const notification = resolveNotification(error)
        submitNewNotification(NotificationUtil.createErrorNotification(NotificationsDataMap[notification]));
    };

    const { getRootProps, getInputProps } = useDropzone({
        accept: {
            "application/json": [".json" ],
            "text/plain": [".txt"],
            "application/xml": [".xml"],
        },
        disabled: isImporting,
        multiple: true,
        onDrop: (acceptedFiles) => {
            setIsImporting(true);
            const importer = new (ImporterSpecData[formatType])([labelType]);
            importer.import(acceptedFiles, onAnnotationLoadSuccess, onAnnotationsLoadFailure);
        }
    });

    const onAccept = (type: LabelType) => {
        if (loadedLabelNames.length === 0 || loadedImageData.length === 0) {
            return;
        }

        if (keepCurrentAnnotations) {
            const mergeResult = AnnotationMergeUtil.mergeImportedAnnotations(
                LabelsSelector.getImagesData(),
                LabelsSelector.getLabelNames(),
                GeneralSelector.getMeasurementFunctionByName(),
                loadedImageData,
                loadedLabelNames,
                loadedMeasurementFunctionByName
            );
            updateImageDataAction(mergeResult.imagesData);
            updateLabelNamesAction(mergeResult.labelNames);
            updateMeasurementFunctionsAction(mergeResult.measurementFunctionByName);
        } else {
            updateImageDataAction(loadedImageData);
            updateLabelNamesAction(loadedLabelNames);
            updateMeasurementFunctionsAction(loadedMeasurementFunctionByName);
        }

        updateActiveLabelTypeAction(type);
        PopupActions.close();
    };

    const onReject = (_: LabelType) => {
        PopupActions.close();
    };

    const onAnnotationFormatChange = (format: AnnotationFormatType) => {
        setFormatType(format);
    };

    const hasImportedAnnotations = loadedImageData.length !== 0 && loadedLabelNames.length !== 0;

    const getFailedFilesContent = () => {
        if (failedAnnotationFiles.length === 0) {
            return null;
        }

        return <>
            <p className='extraBold'>These files could not be imported</p>
            {failedAnnotationFiles.map((fileName: string) => <p key={fileName}>{fileName}</p>)}
        </>;
    };

    const getDropZoneContent = () => {
        if (isImporting) {
            return <>
                <ClipLoader
                    color={'white'}
                    size={60}
                    loading={true}
                />
                <p className='extraBold'>Importing annotations</p>
                <p>This can take a while for large VOC batches</p>
            </>;
        } else if (annotationsLoadedError) {
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={'upload'}
                    src={'ico/box-opened.png'}
                />
                <p className='extraBold'>Annotation import was unsuccessful</p>
                {annotationsLoadedError.message}
                <p className='extraBold'>Try again</p>
            </>;
        } else if (hasImportedAnnotations) {
            return <>
                <img
                    draggable={false}
                    alt={'uploaded'}
                    src={'ico/box-closed.png'}
                />
                <p className='extraBold'>Annotation ready for import</p>
                {keepCurrentAnnotations ?
                    'Imported annotations will be added to the ones already in your project' :
                    'After import you will lose all your current annotations'}
                {getFailedFilesContent()}
            </>;
        } else if (failedAnnotationFiles.length !== 0) {
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={'upload'}
                    src={'ico/box-opened.png'}
                />
                {getFailedFilesContent()}
                <p className='extraBold'>Try again</p>
            </>;
        } else {
            return <>
                <input {...getInputProps()} />
                <img
                    draggable={false}
                    alt={'upload'}
                    src={'ico/box-opened.png'}
                />
                <p className='extraBold'>{`Drop ${formatType} annotations`}</p>
                <p>or</p>
                <p className='extraBold'>Click here to select them</p>
            </>;
        }
    };

    const getOptions = (exportFormatData: ILabelFormatData[]) => {
        return exportFormatData.map((entry: ILabelFormatData) => {
            return <div
                className='OptionsItem'
                onClick={() => onAnnotationFormatChange(entry.type)}
                key={entry.type}
            >
                {entry.type === formatType ?
                    <img
                        draggable={false}
                        src={'ico/checkbox-checked.png'}
                        alt={'checked'}
                    /> :
                    <img
                        draggable={false}
                        src={'ico/checkbox-unchecked.png'}
                        alt={'unchecked'}
                    />}
                {entry.label}
            </div>;
        });
    };

    const renderImportOptions = () => {
        return <div className='Options ImportOptions'>
            <div
                className='OptionsItem'
                onClick={() => setKeepCurrentAnnotations(!keepCurrentAnnotations)}
            >
                <img
                    draggable={false}
                    src={keepCurrentAnnotations ? 'ico/checkbox-checked.png' : 'ico/checkbox-unchecked.png'}
                    alt={keepCurrentAnnotations ? 'checked' : 'unchecked'}
                />
                Keep the annotations already in my project
            </div>
        </div>;
    };

    const renderInternalContent = (type: LabelType) => {
        if (!formatType && ImportFormatData[type].length !== 0) {
            return <>
                <div className='Message'>
                    Select file format you would like to use to import labels.
                </div>,
                <div className='Options'>
                    {getOptions(ImportFormatData[type])}
                </div>
            </>;
        }
        const importFormatData = ImportFormatData[type];
        return importFormatData.length === 0 ?
            <FeatureInProgress /> :
            <>
                <div {...getRootProps({ className: 'DropZone' })}>
                    {getDropZoneContent()}
                </div>
                {renderImportOptions()}
            </>;
    };

    return (
        <GenericLabelTypePopup
            activeLabelType={labelType}
            title={`Import ${labelType.toLowerCase()} annotations`}
            onLabelTypeChange={onLabelTypeChange}
            acceptLabel={'Import'}
            onAccept={onAccept}
            skipAcceptButton={ImportFormatData[labelType].length === 0}
            disableAcceptButton={isImporting || loadedImageData.length === 0 || loadedLabelNames.length === 0 || !!annotationsLoadedError}
            rejectLabel={'Cancel'}
            onReject={onReject}
            renderInternalContent={renderInternalContent}
        />
    );
};

const mapDispatchToProps = {
    updateImageDataAction: updateImageData,
    updateLabelNamesAction: updateLabelNames,
    updateActiveLabelTypeAction: updateActiveLabelType,
    updateMeasurementFunctionsAction: updateMeasurementFunctions
};

const mapStateToProps = (state: AppState) => ({
    activeLabelType: state.labels.activeLabelType,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImportLabelPopup);
