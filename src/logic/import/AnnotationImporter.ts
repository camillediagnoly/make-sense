import {ImageData, LabelName, TagConfig} from '../../store/labels/types';
import {LabelType} from '../../data/enums/LabelType';
import { MeasurementFunctionByName } from '../../data/measurements/MeasurementFunctionData';

export type ImportResult = {
    imagesData: ImageData[]
    labelNames: LabelName[]
    measurementFunctionByName?: MeasurementFunctionByName
    tagConfig?: TagConfig
}

export class AnnotationImporter {
    public labelType: LabelType[]

    constructor(labelType: LabelType[]) {
        this.labelType = labelType;
    }

    public import(
        filesData: File[],
        onSuccess: (
            imagesData: ImageData[],
            labelNames: LabelName[],
            measurementFunctionByName?: MeasurementFunctionByName,
            tagConfig?: TagConfig,
        ) => any,
        onFailure: (error?:Error) => any
    ): void {
        throw new Error('Method not implemented.');
    }
}