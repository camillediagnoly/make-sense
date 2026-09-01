import { IRect } from '../../interfaces/IRect';
import { LabelUtil } from '../LabelUtil';
import {ImageData, LabelPoint, LabelPolygon, LabelRect} from '../../store/labels/types';
import {LabelStatus} from '../../data/enums/LabelStatus';
import {IPoint} from '../../interfaces/IPoint';

const mockUUID: string = '123e4567-e89b-12d3-a456-426614174000'

jest.mock('uuid', () => ({ v4: () => mockUUID }));

describe('LabelUtil createLabelRect method', () => {
    it('return correct LabelRect object', () => {
        // given
        const labelId: string = '1';
        const rect: IRect = {
            x: 100,
            y: 100,
            width: 100,
            height: 100
        };

        // when
        const result = LabelUtil.createLabelRect(labelId, rect);

        // then
        const expectedResult: LabelRect = {
            id: mockUUID,
            labelId,
            rect,
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: null
        }
        expect(result).toEqual(expectedResult);
    });
});

describe('LabelUtil createLabelPolygon method', () => {
    it('return correct LabelPolygon object', () => {
        // given
        const labelId: string = '1';
        const vertices: IPoint[] = [
            {
                x: 100,
                y: 100
            },
            {
                x: 100,
                y: 200
            },
            {
                x: 200,
                y: 100
            }
        ];

        // when
        const result = LabelUtil.createLabelPolygon(labelId, vertices);

        // then
        const expectedResult: LabelPolygon = {
            id: mockUUID,
            labelId,
            vertices,
            isVisible: true
        }
        expect(result).toEqual(expectedResult);
    });
});

describe('LabelUtil createLabelPoint method', () => {
    it('return correct LabelPoint object', () => {
        // given
        const labelId: string = '1';
        const point: IPoint = {
            x: 100,
            y: 100
        };

        // when
        const result = LabelUtil.createLabelPoint(labelId, point);

        // then
        const expectedResult: LabelPoint = {
            id: mockUUID,
            labelId,
            point,
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: null
        }
        expect(result).toEqual(expectedResult);
    });
});

const createLabelRect = (id: string, labelId: string | null): LabelRect => ({
    id,
    labelId,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    isVisible: true,
    isCreatedByAI: false,
    status: LabelStatus.ACCEPTED,
    suggestedLabel: null
});

const createImageData = (id: string): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png' }),
    loadStatus: true,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    imgWidth: 640,
    imgHeight: 480,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const imagesDataWithInstances = (): ImageData[] => [
    {
        ...createImageData('image-0'),
        labelRects: [
            createLabelRect('rect-0', 'label-A'),
            createLabelRect('rect-1', 'label-B'),
            createLabelRect('rect-2', null),
        ],
        labelPoints: [{
            id: 'point-0',
            labelId: 'label-A',
            point: { x: 5, y: 5 },
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: null
        }],
        labelNameIds: ['label-A', 'label-B'],
    },
    {
        ...createImageData('image-1'),
        labelPolygons: [{
            id: 'polygon-0',
            labelId: 'label-A',
            vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
            isVisible: true
        }],
        labelLines: [{
            id: 'line-0',
            labelId: 'label-B',
            line: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
            isVisible: true
        }],
    },
];

describe('LabelUtil removeLabelNamesFromImagesData method', () => {
    it('should delete every instance of the removed label names', () => {
        // when
        const result = LabelUtil.removeLabelNamesFromImagesData(
            imagesDataWithInstances(),
            ['label-A']
        );

        // then
        expect(result[0].labelRects.map((labelRect: LabelRect) => labelRect.id))
            .toEqual(['rect-1', 'rect-2']);
        expect(result[0].labelPoints).toEqual([]);
        expect(result[0].labelNameIds).toEqual(['label-B']);
        expect(result[1].labelPolygons).toEqual([]);
        expect(result[1].labelLines.map((labelLine) => labelLine.id)).toEqual(['line-0']);
    });

    it('should keep annotations with no label assigned yet', () => {
        // when
        const result = LabelUtil.removeLabelNamesFromImagesData(
            imagesDataWithInstances(),
            ['label-A', 'label-B']
        );

        // then
        expect(result[0].labelRects.map((labelRect: LabelRect) => labelRect.id)).toEqual(['rect-2']);
        expect(result[0].labelNameIds).toEqual([]);
        expect(result[1].labelPolygons).toEqual([]);
        expect(result[1].labelLines).toEqual([]);
    });

    it('should leave images untouched when no label name is removed', () => {
        // given
        const imagesData = imagesDataWithInstances();

        // when
        const result = LabelUtil.removeLabelNamesFromImagesData(imagesData, []);

        // then
        expect(result).toEqual(imagesData);
    });
});

describe('LabelUtil countLabelNamesInstances method', () => {
    it('should count annotations and image tags of the given label names', () => {
        // given
        const imagesData = imagesDataWithInstances();

        // then
        expect(LabelUtil.countLabelNamesInstances(imagesData, ['label-A'])).toBe(4);
        expect(LabelUtil.countLabelNamesInstances(imagesData, ['label-B'])).toBe(3);
        expect(LabelUtil.countLabelNamesInstances(imagesData, ['label-A', 'label-B'])).toBe(7);
        expect(LabelUtil.countLabelNamesInstances(imagesData, [])).toBe(0);
        expect(LabelUtil.countLabelNamesInstances(imagesData, ['label-C'])).toBe(0);
    });
});

describe('LabelUtil containsAnnotationId method', () => {
    it('should look for the annotation id across every label type', () => {
        // given
        const imagesData = imagesDataWithInstances();

        // then
        expect(LabelUtil.containsAnnotationId(imagesData[0], 'point-0')).toBe(true);
        expect(LabelUtil.containsAnnotationId(imagesData[1], 'line-0')).toBe(true);
        expect(LabelUtil.containsAnnotationId(imagesData[1], 'point-0')).toBe(false);
    });
});
