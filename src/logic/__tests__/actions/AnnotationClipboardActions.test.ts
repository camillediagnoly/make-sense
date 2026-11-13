import { AnnotationClipboardActions } from '../../actions/AnnotationClipboardActions';
import { ImageData, LabelPolygon, LabelRect } from '../../../store/labels/types';
import { LabelStatus } from '../../../data/enums/LabelStatus';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const rect = (id: string, labelId: string | null, x: number = 0): LabelRect => ({
    id,
    labelId,
    isVisible: true,
    rect: { x, y: 0, width: 10, height: 10 },
    isCreatedByAI: false,
    status: LabelStatus.ACCEPTED,
    suggestedLabel: null
});

const polygon = (id: string, labelId: string | null, x: number = 0): LabelPolygon => ({
    id,
    labelId,
    isVisible: true,
    vertices: [{ x, y: 0 }, { x: x + 10, y: 0 }, { x: x + 10, y: 10 }]
});

const image = (partial: Partial<ImageData>): ImageData => ({
    id: 'image',
    fileData: null,
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
} as ImageData);

describe('AnnotationClipboardActions', () => {
    const source: ImageData = image({
        id: 'source',
        labelPolygons: [polygon('p1', 'A', 0), polygon('p2', 'A', 50), polygon('p3', 'B'), polygon('p4', null)],
        labelRects: [rect('r1', 'A', 0), rect('r2', 'A', 50), rect('r3', null)],
        tags: ['Patho', 'Blurry']
    });

    it('copies every labelled polygon and rectangle, including several of the same label, and the tags', () => {
        const clipboard = AnnotationClipboardActions.copyFromImage(source);
        expect(clipboard.labelPolygons.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
        expect(clipboard.labelRects.map((r) => r.id)).toEqual(['r1', 'r2']);
        expect(clipboard.tags).toEqual(['Patho', 'Blurry']);
    });

    it('pastes all copied annotations, replacing only the ones of the same label and type', () => {
        const clipboard = AnnotationClipboardActions.copyFromImage(source);
        const target: ImageData = image({
            id: 'target',
            labelPolygons: [polygon('t1', 'A', 99), polygon('t2', 'C')],
            labelRects: [rect('t3', 'A', 99), rect('t4', 'B')],
            tags: ['Blurry', 'Other']
        });

        const result = AnnotationClipboardActions.pasteOnImage(target, clipboard);

        expect(result.labelPolygons.map((p) => [p.labelId, p.vertices[0].x])).toEqual([
            ['C', 0], ['A', 0], ['A', 50], ['B', 0]
        ]);
        expect(result.labelRects.map((r) => [r.labelId, r.rect.x])).toEqual([
            ['B', 0], ['A', 0], ['A', 50]
        ]);
        expect(result.tags).toEqual(['Blurry', 'Other', 'Patho']);
        // Pasted annotations get fresh ids and do not share geometry with the source
        expect(result.labelPolygons.some((p) => ['p1', 'p2', 'p3'].includes(p.id))).toBe(false);
        expect(result.labelPolygons[1].vertices).not.toBe(source.labelPolygons[0].vertices);
        expect(result.labelRects[1].rect).not.toBe(source.labelRects[0].rect);
    });

    it('can paste the same clipboard twice without duplicating annotations', () => {
        const clipboard = AnnotationClipboardActions.copyFromImage(source);
        const once = AnnotationClipboardActions.pasteOnImage(image({}), clipboard);
        const twice = AnnotationClipboardActions.pasteOnImage(once, clipboard);
        expect(twice.labelPolygons).toHaveLength(3);
        expect(twice.labelRects).toHaveLength(2);
        expect(twice.tags).toEqual(['Patho', 'Blurry']);
    });
});
