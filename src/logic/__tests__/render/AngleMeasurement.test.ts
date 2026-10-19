import { KeypointUtils } from '../../render/PolygonRenderEngine';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { MeasurementFunctionId } from '../../../data/measurements/MeasurementFunctionData';
import { ImageData, LabelName, LabelPolygon } from '../../../store/labels/types';
import { IPoint } from '../../../interfaces/IPoint';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const keypoint = (labelId: string, { x, y }: IPoint): LabelPolygon => ({
    id: `polygon-${labelId}`,
    labelId,
    isVisible: true,
    vertices: [
        { x: x - 1, y: y - 1 },
        { x: x + 1, y: y - 1 },
        { x: x + 1, y: y + 1 },
        { x: x - 1, y: y + 1 }
    ]
});

// points[i] is the keypoint of p-c.k:TOF-(i + 1), or null when the image does not have it
const setUpTof = (labelCount: number, points: Array<IPoint | null>) => {
    const labels: LabelName[] = Array.from({ length: labelCount }, (_, index) => ({
        id: `TOF-${index + 1}`,
        name: `p-c.k:TOF-${index + 1}`
    }));
    const labelPolygons = points
        .map((point, index) => (point ? keypoint(labels[index].id, point) : null))
        .filter((polygon) => !!polygon);
    jest.spyOn(LabelsSelector, 'getLabelNames').mockReturnValue(labels);
    jest.spyOn(LabelsSelector, 'getActiveImageData').mockReturnValue({
        id: 'image',
        fileData: null,
        loadStatus: true,
        labelRects: [],
        labelPoints: [],
        labelLines: [],
        labelPolygons,
        labelNameIds: [],
        isVisitedByYOLOObjectDetector: false,
        isVisitedBySSDObjectDetector: false,
        isVisitedByPoseDetector: false,
        isVisitedByRoboflowAPI: false
    } as ImageData);
    jest.spyOn(GeneralSelector, 'getMeasurementFunctionByName').mockReturnValue({
        'p-c.k:TOF': MeasurementFunctionId.ANGLE
    });
};

const measure = () => new KeypointUtils().buildMeasurementResults()[0];

// p1-p2 along the x axis and p3-p4 at 60 degrees to it; mirroredP4 is p4 mirrored across p3's
// horizontal, which flips the sign of the raw angle
const p1 = { x: 0, y: 0 };
const p2 = { x: 10, y: 0 };
const p3 = { x: 20, y: 0 };
const p4 = { x: 25, y: 5 * Math.sqrt(3) };
const mirroredP4 = { x: 25, y: -5 * Math.sqrt(3) };

afterEach(() => {
    jest.restoreAllMocks();
});

describe('Angle with 4 keypoints', () => {
    it('is the unsigned angle between p1-p2 and p3-p4, in degrees', () => {
        setUpTof(4, [p1, p2, p3, p4]);
        expect(measure().value).toBeCloseTo(60, 6);
        expect(measure().unit).toBe('degree');

        setUpTof(4, [p1, p2, p3, mirroredP4]);
        expect(measure().value).toBeCloseTo(60, 6);
    });

    it('is null when the image misses one of p1-p4', () => {
        setUpTof(4, [p1, p2, p3, null]);
        expect(measure().value).toBeNull();
    });
});

describe('Angle with 5 keypoints', () => {
    it('takes its sign from the side of p3-p4 that p5 is on', () => {
        setUpTof(5, [p1, p2, p3, p4, { x: 30, y: 0 }]);
        expect(measure().value).toBeCloseTo(60, 6);

        setUpTof(5, [p1, p2, p3, p4, { x: 20, y: 10 }]);
        expect(measure().value).toBeCloseTo(-60, 6);
    });

    it('still requires p5 on the image once the measurement has a p5 label', () => {
        setUpTof(5, [p1, p2, p3, p4, null]);
        expect(measure().value).toBeNull();
    });
});
