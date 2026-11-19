import {
    AnnotationFormatDetectionError,
    AnnotationImportActions
} from '../../actions/AnnotationImportActions';
import { AnnotationFormatType } from '../../../data/enums/AnnotationFormatType';
import { LabelType } from '../../../data/enums/LabelType';
import { ImageData } from '../../../store/labels/types';
import { LabelUtil } from '../../../utils/LabelUtil';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const file = (name: string): File => new File([''], name);

const image = (partial: Partial<ImageData> = {}): ImageData => ({
    id: 'image',
    fileData: file('image.jpg'),
    loadStatus: true,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    tags: [],
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
    ...partial
});

describe('AnnotationImportActions.detectFormat', () => {
    it('reads polygons from a single COCO JSON file', () => {
        expect(AnnotationImportActions.detectFormat([file('annotations.json')], LabelType.POLYGON))
            .toBe(AnnotationFormatType.COCO);
    });

    it('refuses anything but JSON for polygons', () => {
        expect(() => AnnotationImportActions.detectFormat([file('a.xml')], LabelType.POLYGON))
            .toThrow(AnnotationFormatDetectionError);
    });

    it('reads rectangles from VOC XML files, whatever the case of their extension', () => {
        expect(AnnotationImportActions.detectFormat([file('a.xml'), file('b.XML')], LabelType.RECT))
            .toBe(AnnotationFormatType.VOC);
    });

    it('reads rectangles from a single COCO JSON file', () => {
        expect(AnnotationImportActions.detectFormat([file('annotations.json')], LabelType.RECT))
            .toBe(AnnotationFormatType.COCO);
    });

    it('reads rectangles from YOLO text files along with their labels.txt', () => {
        expect(AnnotationImportActions.detectFormat([file('a.txt'), file('labels.txt')], LabelType.RECT))
            .toBe(AnnotationFormatType.YOLO);
    });

    it('asks for labels.txt when YOLO files come without it', () => {
        expect(() => AnnotationImportActions.detectFormat([file('a.txt')], LabelType.RECT))
            .toThrow(/labels\.txt/);
    });

    it('refuses several JSON files', () => {
        expect(() => AnnotationImportActions.detectFormat([file('a.json'), file('b.json')], LabelType.RECT))
            .toThrow(/single JSON file/);
    });

    it('refuses files mixing formats', () => {
        expect(() => AnnotationImportActions.detectFormat([file('a.xml'), file('b.json')], LabelType.RECT))
            .toThrow(/mix several formats/);
    });

    it('refuses an empty selection', () => {
        expect(() => AnnotationImportActions.detectFormat([], LabelType.RECT))
            .toThrow(AnnotationFormatDetectionError);
    });
});

describe('AnnotationImportActions.projectHasAnnotations', () => {
    it('is false for images without annotations or tags', () => {
        expect(AnnotationImportActions.projectHasAnnotations([image(), image({ id: 'other' })])).toBe(false);
    });

    it('is true as soon as an image has an annotation of any type', () => {
        const polygon = LabelUtil.createLabelPolygon('label', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
        expect(AnnotationImportActions.projectHasAnnotations([image(), image({ labelPolygons: [polygon] })]))
            .toBe(true);
    });

    it('is true when an image only has tags, since replacing would remove them', () => {
        expect(AnnotationImportActions.projectHasAnnotations([image({ tags: ['Patho'] })])).toBe(true);
    });
});
