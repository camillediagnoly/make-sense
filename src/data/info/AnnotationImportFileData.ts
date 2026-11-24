import { LabelType } from '../enums/LabelType';
import { ImportableLabelType } from '../../logic/actions/AnnotationImportActions';

// The annotation files each import field takes
export const ACCEPTED_ANNOTATION_FILES_BY_LABEL_TYPE: Record<ImportableLabelType, Record<string, string[]>> = {
    [LabelType.POLYGON]: {
        'application/json': ['.json']
    },
    [LabelType.RECT]: {
        'application/json': ['.json'],
        'application/xml': ['.xml'],
        'text/plain': ['.txt']
    }
};

export const ANNOTATION_IMPORT_TOOLTIPS: Record<ImportableLabelType, string> = {
    [LabelType.POLYGON]: 'Drop a COCO JSON file here, or click to pick it',
    [LabelType.RECT]: 'Drop VOC XML files, a COCO JSON file or YOLO files with their labels.txt here, ' +
        'or click to pick them'
};
