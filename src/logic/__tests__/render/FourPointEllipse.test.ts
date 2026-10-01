import {
    KeypointSurfaceAnnotation,
    KeypointUtils,
    PolygonRenderEngine,
} from '../../render/PolygonRenderEngine';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { store } from '../../../index';
import {
    getMeasurementConnections,
    MeasurementFunctionId,
} from '../../../data/measurements/MeasurementFunctionData';
import { ImageData, LabelName, LabelPolygon } from '../../../store/labels/types';
import { EditorData } from '../../../data/EditorData';
import { IPoint } from '../../../interfaces/IPoint';

jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn()
    }
}));

const SURFACE = MeasurementFunctionId.SURFACE_ELLIPSE_AREA_RATIO;
const POSITION = MeasurementFunctionId.POSITION_ELLIPSE_SPLIT_RATIO;

// Thorax keypoints on the ellipse centred at (2.4, 0) with semi-axes 5 along the sternum-spine line
// and 4 across it: area 20 pi. The ribs do not mirror each other across that line.
const sternum = { x: 0, y: 4 };
const spine = { x: 0, y: -4 };
const leftRib = { x: -1.6, y: 0 };
const rightRib = { x: 5.6, y: 3 };
// Heart ellipse with semi-axes 1 and 0.5: area 0.5 pi
const heart = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0.5, y: 0 }];
// The 3-point thorax ellipse has the sternum and spine as axis ends and goes through the left rib:
// semi-axes 4 and 1.6
const threePointThoraxArea = Math.PI * 4 * 1.6;

// (x/a)^2 + (y/b)^2 of the point in the ellipse frame: 1 when it lies on the ellipse
const onEllipse = (point: IPoint, ellipse): number => {
    const dx = point.x - ellipse.center.x;
    const dy = point.y - ellipse.center.y;
    const cosine = Math.cos(ellipse.rotateAngle);
    const sine = Math.sin(ellipse.rotateAngle);
    const x = cosine * dx + sine * dy;
    const y = -sine * dx + cosine * dy;
    return (x / ellipse.majorAxis) ** 2 + (y / ellipse.minorAxis) ** 2;
};

const labelNames = (measurement: string, count: number): LabelName[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `${measurement}-${index + 1}`,
        name: `p-b.k:${measurement}-${index + 1}`
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

const imageData = (labelPolygons: LabelPolygon[]): ImageData => ({
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
});

// points[i] is the keypoint of label i + 1, or null when the image does not have it
const setUpMeasurement = (
    measurement: string,
    functionId: MeasurementFunctionId,
    labelCount: number,
    points: Array<IPoint | null>
) => {
    const labels = labelNames(measurement, labelCount);
    const polygons = points
        .map((point, index) => (point ? keypoint(labels[index].id, point) : null))
        .filter((polygon) => !!polygon);
    jest.spyOn(LabelsSelector, 'getLabelNames').mockReturnValue(labels);
    jest.spyOn(LabelsSelector, 'getActiveImageData').mockReturnValue(imageData(polygons));
    jest.spyOn(GeneralSelector, 'getMeasurementFunctionByName').mockReturnValue({
        [`p-b.k:${measurement}`]: functionId
    });
};

const measure = (): number | null => new KeypointUtils().buildMeasurementResults()[0].value;

afterEach(() => {
    jest.restoreAllMocks();
    (store.dispatch as jest.Mock).mockReset();
});

describe('KeypointSurfaceAnnotation.computeFourPointEllipse', () => {
    it('goes through the 4 points, with its axes along and across the sternum-spine line', () => {
        const ellipse = KeypointSurfaceAnnotation.computeFourPointEllipse(
            sternum,
            spine,
            leftRib,
            rightRib
        );

        expect(ellipse.center.x).toBeCloseTo(2.4);
        expect(ellipse.center.y).toBeCloseTo(0);
        expect(ellipse.majorAxis).toBeCloseTo(5);
        expect(ellipse.minorAxis).toBeCloseTo(4);
        expect(ellipse.rotateAngle).toBeCloseTo(-Math.PI / 2);
        [sternum, spine, leftRib, rightRib].forEach((point) =>
            expect(onEllipse(point, ellipse)).toBeCloseTo(1)
        );
    });

    it('handles a tilted sternum-spine line', () => {
        // E0074_IMG_20170623_1_23.mp4_00167.jpg, right rib placed by hand; values from
        // model_four_on_curve in extracted-frames/utils/tools/thorax_ellipse_tool.py
        const ellipse = KeypointSurfaceAnnotation.computeFourPointEllipse(
            { x: 689.39313984, y: 233.79419525 },
            { x: 434.24274406, y: 751.96306069 },
            { x: 282.50131926, y: 420.37994723 },
            { x: 851, y: 636 }
        );

        expect(ellipse.center.x).toBeCloseTo(576.96, 1);
        expect(ellipse.center.y).toBeCloseTo(500.34, 1);
        expect(ellipse.majorAxis).toBeCloseTo(289.23, 1);
        expect(ellipse.minorAxis).toBeCloseTo(305.78, 1);
    });

    it('is the 3-point ellipse when the ribs mirror each other across sternum-spine', () => {
        const mirroredRibs = [{ x: -3, y: 1 }, { x: 3, y: 1 }];
        const ellipse = KeypointSurfaceAnnotation.computeFourPointEllipse(
            sternum,
            spine,
            mirroredRibs[0],
            mirroredRibs[1]
        );
        const threePoint = KeypointSurfaceAnnotation.computeEllipse(
            sternum,
            spine,
            mirroredRibs[0]
        );

        expect(ellipse.center.x).toBeCloseTo(threePoint.center.x);
        expect(ellipse.center.y).toBeCloseTo(threePoint.center.y);
        expect(ellipse.majorAxis).toBeCloseTo(threePoint.majorAxis);
        expect(ellipse.minorAxis).toBeCloseTo(threePoint.minorAxis);
    });

    it('returns null when the ribs are on the same side of the sternum-spine line', () => {
        const sameSideRib = { x: -1, y: 2 };
        expect(
            KeypointSurfaceAnnotation.computeFourPointEllipse(sternum, spine, leftRib, sameSideRib)
        ).toBeNull();
    });

    it('returns null when no ellipse with those axes goes through the 4 points', () => {
        const ribPastSternum = { x: 1, y: 12 };
        expect(
            KeypointSurfaceAnnotation.computeFourPointEllipse(
                sternum,
                spine,
                leftRib,
                ribPastSternum
            )
        ).toBeNull();
    });
});

describe('KeypointSurfaceAnnotation.computeEllipse', () => {
    it('still makes the first two points the axis ends and passes through the third', () => {
        const ellipse = KeypointSurfaceAnnotation.computeEllipse(
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 8, y: 2.4 }
        );

        expect(ellipse.majorAxis).toBeCloseTo(5);
        expect(ellipse.minorAxis).toBeCloseTo(3);
    });
});

describe('getMeasurementConnections', () => {
    const thoraxOf = (functionId: MeasurementFunctionId, keypointCount: number) =>
        getMeasurementConnections(functionId, keypointCount).find(
            (connection) => connection.type === 'ellipse'
        );

    it('gives the thorax ellipse a 4th point only when its label exists', () => {
        expect(thoraxOf(SURFACE, 6)).not.toHaveProperty('fourthPosition');
        expect(thoraxOf(SURFACE, 7)).toHaveProperty('fourthPosition', 3);
        expect(thoraxOf(POSITION, 5)).not.toHaveProperty('fourthPosition');
        expect(thoraxOf(POSITION, 6)).toHaveProperty('fourthPosition', 5);
    });

    it('moves the heart ellipse after the right rib (p4)', () => {
        const heartOf = (keypointCount: number) =>
            getMeasurementConnections(SURFACE, keypointCount)[1];

        expect(heartOf(6)).toEqual({
            type: 'ellipse',
            firstPosition: 3,
            secondPosition: 4,
            thirdPosition: 5
        });
        expect(heartOf(7)).toEqual({
            type: 'ellipse',
            firstPosition: 4,
            secondPosition: 5,
            thirdPosition: 6
        });
    });
});

describe('Ellipse Area Ratio with the optional right rib (p4)', () => {
    it('uses the 4-point thorax when p4 is annotated', () => {
        setUpMeasurement('Surface', SURFACE, 7, [sternum, spine, leftRib, rightRib, ...heart]);
        expect(measure()).toBeCloseTo(0.5 / 20, 6);
    });

    it('falls back to the 3-point thorax when the image has no p4', () => {
        setUpMeasurement('Surface', SURFACE, 7, [sternum, spine, leftRib, null, ...heart]);
        expect(measure()).toBeCloseTo((0.5 * Math.PI) / threePointThoraxArea, 6);
    });

    it('reads the heart from p4-p6 for measurements without a 7th label', () => {
        setUpMeasurement('Surface', SURFACE, 6, [sternum, spine, leftRib, ...heart]);
        expect(measure()).toBeCloseTo((0.5 * Math.PI) / threePointThoraxArea, 6);
    });

    it('still requires the heart keypoints p5-p7', () => {
        const [heart1, , heart3] = heart;
        const points = [sternum, spine, leftRib, rightRib, heart1, null, heart3];
        setUpMeasurement('Surface', SURFACE, 7, points);
        expect(measure()).toBeNull();
    });

    it('is null when p4 gives no valid 4-point thorax', () => {
        const sameSideRib = { x: -1, y: 2 };
        const points = [sternum, spine, leftRib, sameSideRib, ...heart];
        setUpMeasurement('Surface', SURFACE, 7, points);
        expect(measure()).toBeNull();
    });
});

describe('Ellipse Split Ratio with the optional right rib (p6)', () => {
    // Splitting along the sternum-spine line keeps the right rib side. The 3-point thorax is
    // symmetric about that line (0.5). The 4-point one loses the segment beyond it on the left rib
    // side: scaled across by 5 / 4, that is a segment 3 from the centre of a circle of radius 5.
    const splitLine = [{ x: 0, y: -10 }, { x: 0, y: 10 }];
    const fourPointRatio = 1 - (0.8 * (25 * Math.acos(3 / 5) - 3 * 4)) / (20 * Math.PI);

    it('splits the 4-point thorax when p6 is annotated', () => {
        const points = [...splitLine, sternum, spine, leftRib, rightRib];
        setUpMeasurement('Position', POSITION, 6, points);
        expect(measure()).toBeCloseTo(fourPointRatio, 2);
    });

    it('falls back to the 3-point thorax when the image has no p6', () => {
        setUpMeasurement('Position', POSITION, 5, [...splitLine, sternum, spine, leftRib]);
        const withoutP6Label = measure();
        setUpMeasurement('Position', POSITION, 6, [...splitLine, sternum, spine, leftRib, null]);

        expect(measure()).toBeCloseTo(withoutP6Label, 6);
        expect(withoutP6Label).not.toBeCloseTo(fourPointRatio, 2);
    });
});

describe('PolygonRenderEngine in ellipse mode', () => {
    // The image fills the view port 1:1, so view port and image coordinates are the same
    const data = {
        viewPortContentImageRect: { x: 0, y: 0, width: 100, height: 100 },
        realImageSize: { width: 100, height: 100 },
        mousePositionOnViewPortContent: { x: 0, y: 0 }
    } as unknown as EditorData;

    // The clicked points and the click handler are private to the engine
    type EngineInternals = {
        activePath: IPoint[];
        updateActivelyCreatedLabel: (data: EditorData) => void;
    };
    const internalsOf = (engine: PolygonRenderEngine) => engine as unknown as EngineInternals;

    const createEngine = (activeLabelId: string, activePath: IPoint[]) => {
        setUpMeasurement('Surface', SURFACE, 7, []);
        jest.spyOn(LabelsSelector, 'getActiveLabelNameId').mockReturnValue(activeLabelId);
        jest.spyOn(GeneralSelector, 'getLineKeypointModeStatus').mockReturnValue(false);
        const engine = new PolygonRenderEngine(document.createElement('canvas'));
        engine.isDrawingEllipse = true;
        internalsOf(engine).activePath = activePath.map((point) => ({ ...point }));
        return engine;
    };
    const click = (engine: PolygonRenderEngine) =>
        internalsOf(engine).updateActivelyCreatedLabel(data);
    const pathLength = (engine: PolygonRenderEngine) => internalsOf(engine).activePath.length;
    const thoraxPoints = [{ x: 50, y: 10 }, { x: 50, y: 90 }, { x: 10, y: 50 }, { x: 90, y: 50 }];

    it('accepts a 4th point for the thorax ellipse, but not a 5th', () => {
        const engine = createEngine('Surface-1', thoraxPoints.slice(0, 3));
        click(engine);
        expect(pathLength(engine)).toBe(4);
        click(engine);
        expect(pathLength(engine)).toBe(4);
    });

    it('does not accept a 4th point for the heart ellipse', () => {
        const engine = createEngine('Surface-5', thoraxPoints.slice(0, 3));
        click(engine);
        expect(pathLength(engine)).toBe(3);
    });

    it('labels the 4 points sternum, spine, left rib and right rib (p4)', () => {
        const engine = createEngine('Surface-1', thoraxPoints);
        engine.addLabelAndFinishCreationEllipse(data);

        const dispatched = (store.dispatch as jest.Mock).mock.calls
            .map(([action]) => action)
            .find((action) => action.payload && action.payload.newImageData);
        expect(
            dispatched.payload.newImageData.labelPolygons.map((polygon) => polygon.labelId)
        ).toEqual(['Surface-1', 'Surface-2', 'Surface-3', 'Surface-4']);
        expect(pathLength(engine)).toBe(0);
    });
});
