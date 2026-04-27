
import {ImageData, LabelName, LabelRect} from '../../../store/labels/types';
import {LabelStatus} from '../../../data/enums/LabelStatus';
import {ISize} from '../../../interfaces/ISize';
import {RectLabelsExporter} from '../../export/RectLabelsExporter';
import {LabelsSelector} from '../../../store/selectors/LabelsSelector';
import {GeneralSelector} from '../../../store/selectors/GeneralSelector';
import {ImageRepository} from '../../imageRepository/ImageRepository';

const imageSize: ISize = {
    width: 1920,
    height: 1080
}
const labelNames: LabelName[] = [
    {
        id: 'label-000',
        name: 'label-name-000',
        color: '#000000'
    },
    {
        id: 'label-001',
        name: 'label-name-001',
        color: '#000000'
    },
    {
        id: 'label-002',
        name: 'label-name-002',
        color: '#000000'
    },
    {
        id: 'label-003',
        name: 'label-name-003',
        color: '#000000'
    },
]
const imageName: string = 'image-name.png'

describe('RectLabelsExporter wrapRectLabelIntoYOLO method', () => {
    it('should produce correct single label entry given issue #171 example 1', () => {
        // given
        const labelRect: LabelRect = {
            id: 'label-rect-000',
            labelId: 'label-002',
            rect: {
                x: 444,
                y: 998,
                width: 90,
                height: 82
            },
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: 'label-000'
        }

        // when
        const result = RectLabelsExporter.wrapRectLabelIntoYOLO(labelRect, labelNames, imageSize)

        // then
        const [
            resultClassIdx,
            resultX,
            resultY,
            resultWidth,
            resultHeight
        ] = result.split(' ').map((value: string) => parseFloat(value))
        expect(resultClassIdx).toBe(2)
        expect(resultX + resultWidth / 2 <= 1).toBeTruthy()
        expect(resultX - resultWidth / 2 >= 0).toBeTruthy()
        expect(resultY + resultHeight / 2 <= 1).toBeTruthy()
        expect(resultY - resultHeight / 2 >= 0).toBeTruthy()
    })

    it('should produce correct single label entry given issue #171 example 2', () => {
        // given
        const labelRect: LabelRect = {
            id: 'label-rect-000',
            labelId: 'label-002',
            rect: {
                x: 1828,
                y: 710,
                width: 92,
                height: 104
            },
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: 'label-000'
        }

        // when
        const result = RectLabelsExporter.wrapRectLabelIntoYOLO(labelRect, labelNames, imageSize)

        // then
        const [
            resultClassIdx,
            resultX,
            resultY,
            resultWidth,
            resultHeight
        ] = result.split(' ').map((value: string) => parseFloat(value))
        expect(resultClassIdx).toBe(2)
        expect(resultX + resultWidth / 2 <= 1).toBeTruthy()
        expect(resultX - resultWidth / 2 >= 0).toBeTruthy()
        expect(resultY + resultHeight / 2 <= 1).toBeTruthy()
        expect(resultY - resultHeight / 2 >= 0).toBeTruthy()
    })

    it('should produce correct single label entry given issue #171 example 3', () => {
        // given
        const labelRect: LabelRect = {
            id: 'label-rect-000',
            labelId: 'label-002',
            rect: {
                x: 0,
                y: 138,
                width: 80,
                height: 70
            },
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: 'label-000'
        }

        // when
        const result = RectLabelsExporter.wrapRectLabelIntoYOLO(labelRect, labelNames, imageSize)

        // then
        const [
            resultClassIdx,
            resultX,
            resultY,
            resultWidth,
            resultHeight
        ] = result.split(' ').map((value: string) => parseFloat(value))
        expect(resultClassIdx).toBe(2)
        expect(resultX + resultWidth / 2 <= 1).toBeTruthy()
        expect(resultX - resultWidth / 2 >= 0).toBeTruthy()
        expect(resultY + resultHeight / 2 <= 1).toBeTruthy()
        expect(resultY - resultHeight / 2 >= 0).toBeTruthy()
    })
})

describe('RectLabelsExporter wrapRectLabelIntoCSV method', () => {
    it('should produce correct single label', () => {
        // given
        const labelRect: LabelRect = {
            id: 'label-rect-000',
            labelId: 'label-002',
            rect: {
                x: 444,
                y: 998,
                width: 90,
                height: 82
            },
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: 'label-000'
        }

        // when
        const result = RectLabelsExporter.wrapRectLabelIntoCSV(labelRect, labelNames, imageSize, imageName)

        // then
        const [
            resultClassIdx,
            resultBoxX,
            resultBoxY,
            resultBoxWidth,
            resultBoxHeight,
            resultImageName,
            resultImageWidth,
            resultImageHeight,
        ] = result.split(',')
        expect(resultClassIdx).toBe('label-name-002')
        expect(parseFloat(resultBoxX)).toBe(444)
        expect(parseFloat(resultBoxY)).toBe(998)
        expect(parseFloat(resultBoxWidth)).toBe(90)
        expect(parseFloat(resultBoxHeight)).toBe(82)
        expect(resultImageName).toBe(imageName)
        expect(parseFloat(resultImageWidth)).toBe(1920)
        expect(parseFloat(resultImageHeight)).toBe(1080)
    })
})

describe('RectLabelsExporter wrapImageIntoVOC method', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    })

    it('should export labeled image data when loadStatus is false and use stored dimensions', () => {
        // given
        const imageData: ImageData = {
            id: 'image-000',
            fileData: new File([''], imageName, {type: 'image/png'}),
            loadStatus: false,
            labelRects: [{
                id: 'label-rect-000',
                labelId: 'label-002',
                rect: {
                    x: 10,
                    y: 20,
                    width: 30,
                    height: 40
                },
                isVisible: true,
                isCreatedByAI: false,
                status: LabelStatus.ACCEPTED,
                suggestedLabel: 'label-000'
            }],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: [],
            imgWidth: 640,
            imgHeight: 480,
            isVisitedByYOLOObjectDetector: false,
            isVisitedBySSDObjectDetector: false,
            isVisitedByPoseDetector: false,
            isVisitedByRoboflowAPI: false
        }
        jest.spyOn(LabelsSelector, 'getLabelNames').mockReturnValue(labelNames);
        jest.spyOn(GeneralSelector, 'getProjectName').mockReturnValue('project-name');
        jest.spyOn(ImageRepository, 'getById').mockReturnValue(null);

        // when
        const result = (RectLabelsExporter as any).wrapImageIntoVOC(imageData);

        // then
        expect(result).toContain(`<filename>${imageName}</filename>`);
        expect(result).toContain(`<width>640</width>`);
        expect(result).toContain(`<height>480</height>`);
        expect(result).toContain(`<name>label-name-002</name>`);
    })
})
