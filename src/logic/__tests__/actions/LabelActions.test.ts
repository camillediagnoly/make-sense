import { LabelActions } from '../../actions/LabelActions';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { store } from '../../../index';
import { Annotation, ImageData, LabelPolygon, LabelRect } from '../../../store/labels/types';
import { LabelStatus } from '../../../data/enums/LabelStatus';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const rect = (id: string, isVisible: boolean): LabelRect => ({
    id,
    labelId: 'label_name_1',
    isVisible,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    isCreatedByAI: false,
    status: LabelStatus.ACCEPTED,
    suggestedLabel: null
});

const polygon = (id: string, isVisible: boolean): LabelPolygon => ({
    id,
    labelId: 'label_name_1',
    isVisible,
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
});

const imageData = (id: string, labelRects: LabelRect[], labelPolygons: LabelPolygon[]): ImageData => ({
    id,
    fileData: null,
    loadStatus: true,
    labelRects,
    labelPoints: [],
    labelLines: [],
    labelPolygons,
    labelNameIds: [],
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false
});

const visibilityOf = (data: ImageData): Record<string, boolean> => [
    ...data.labelRects,
    ...data.labelPoints,
    ...data.labelPolygons,
    ...data.labelLines
].reduce((result: Record<string, boolean>, annotation: Annotation) => {
    result[annotation.id] = annotation.isVisible;
    return result;
}, {});

// Mimics the store: LabelActions reads the image through the selector and writes it back
// through a dispatch, so each toggle has to see what the previous one produced.
const setUpStore = (initialImageData: ImageData): { current: () => ImageData } => {
    let current: ImageData = initialImageData;
    jest.spyOn(LabelsSelector, 'getImageDataById').mockImplementation(() => current);
    (store.dispatch as jest.Mock).mockImplementation((action: any) => {
        current = action.payload.newImageData;
        return action;
    });
    return { current: () => current };
};

describe('LabelActions toggleLabelsVisibilityWithRestoreInImage method', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        (store.dispatch as jest.Mock).mockReset();
    });

    it('should hide every label and then restore only the ones visible before', () => {
        // GIVEN
        const state = setUpStore(imageData(
            'image_hide_and_restore',
            [rect('rect_1', true), rect('rect_2', false)],
            [polygon('polygon_1', true)]
        ));

        // WHEN
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_hide_and_restore');

        // THEN
        expect(visibilityOf(state.current())).toEqual({
            rect_1: false,
            rect_2: false,
            polygon_1: false
        });

        // WHEN
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_hide_and_restore');

        // THEN
        expect(visibilityOf(state.current())).toEqual({
            rect_1: true,
            rect_2: false,
            polygon_1: true
        });
    });

    it('should leave labels created while hidden untouched on restore', () => {
        // GIVEN
        const state = setUpStore(imageData('image_new_label', [rect('rect_1', true)], []));

        // WHEN
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_new_label');
        const withNewLabel: ImageData = {
            ...state.current(),
            labelRects: [...state.current().labelRects, rect('rect_2', true)]
        };
        (store.dispatch as jest.Mock)({ payload: { newImageData: withNewLabel } });
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_new_label');

        // THEN
        expect(visibilityOf(state.current())).toEqual({
            rect_1: true,
            rect_2: true
        });
    });

    it('should hide again after a restore instead of staying stuck', () => {
        // GIVEN
        const state = setUpStore(imageData('image_hide_twice', [rect('rect_1', true), rect('rect_2', false)], []));

        // WHEN
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_hide_twice');
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_hide_twice');
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_hide_twice');

        // THEN
        expect(visibilityOf(state.current())).toEqual({
            rect_1: false,
            rect_2: false
        });
    });

    it('should forget the remembered visibility once all labels are shown again', () => {
        // GIVEN
        const state = setUpStore(imageData('image_stale_snapshot', [rect('rect_1', true), rect('rect_2', false)], []));

        // WHEN
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_stale_snapshot');
        LabelActions.toggleAllLabelsVisibilityInImage('image_stale_snapshot');
        LabelActions.toggleLabelsVisibilityWithRestoreInImage('image_stale_snapshot');

        // THEN - the last toggle hides, it does not restore the stale snapshot
        expect(visibilityOf(state.current())).toEqual({
            rect_1: false,
            rect_2: false
        });
    });
});
