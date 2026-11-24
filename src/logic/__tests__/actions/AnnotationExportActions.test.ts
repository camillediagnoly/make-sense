import { AnnotationExportActions } from '../../actions/AnnotationExportActions';
import { LabelType } from '../../../data/enums/LabelType';
import { labelsReducer } from '../../../store/labels/reducer';
import { updateActiveLabelType, updateAnnotationMode } from '../../../store/labels/actionCreators';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

describe('AnnotationExportActions.resolveExportedLabelType', () => {
    it('exports the imported type, whatever type is drawn', () => {
        expect(AnnotationExportActions.resolveExportedLabelType(LabelType.POLYGON, LabelType.RECT))
            .toBe(LabelType.POLYGON);
        expect(AnnotationExportActions.resolveExportedLabelType(LabelType.RECT, LabelType.POLYGON))
            .toBe(LabelType.RECT);
    });

    it('exports the type drawn before any import, polygons by default', () => {
        expect(AnnotationExportActions.resolveExportedLabelType(null, LabelType.POLYGON)).toBe(LabelType.POLYGON);
        expect(AnnotationExportActions.resolveExportedLabelType(null, LabelType.RECT)).toBe(LabelType.RECT);
        expect(AnnotationExportActions.resolveExportedLabelType(null, null)).toBe(LabelType.POLYGON);
    });
});

describe('labelsReducer annotation mode', () => {
    it('makes the mode the active label type', () => {
        const initialState = labelsReducer(undefined, updateActiveLabelType(LabelType.RECT));

        const state = labelsReducer(initialState, updateAnnotationMode(LabelType.POLYGON));

        expect(state.annotationMode).toBe(LabelType.POLYGON);
        expect(state.activeLabelType).toBe(LabelType.POLYGON);
    });

    it('keeps the active label type when the mode is cleared', () => {
        const withMode = labelsReducer(undefined, updateAnnotationMode(LabelType.RECT));

        const state = labelsReducer(withMode, updateAnnotationMode(null));

        expect(state.annotationMode).toBeNull();
        expect(state.activeLabelType).toBe(LabelType.RECT);
    });
});
