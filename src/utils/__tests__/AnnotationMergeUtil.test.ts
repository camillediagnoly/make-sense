import { AnnotationMergeUtil } from '../AnnotationMergeUtil';
import { ImageData, LabelName, LabelRect } from '../../store/labels/types';
import { LabelStatus } from '../../data/enums/LabelStatus';
import { MeasurementFunctionId } from '../../data/measurements/MeasurementFunctionData';

const createLabelRect = (id: string, labelId: string | null): LabelRect => ({
    id,
    labelId,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    isVisible: true,
    isCreatedByAI: false,
    status: LabelStatus.ACCEPTED,
    suggestedLabel: null
});

const createImageData = (id: string, labelRects: LabelRect[] = [], labelNameIds: string[] = []): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png' }),
    loadStatus: true,
    labelRects,
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds,
    imgWidth: 640,
    imgHeight: 480,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

const currentLabelNames: LabelName[] = [
    { id: 'current-cat', name: 'cat', color: '#fff', isVisible: true }
];

// An importer mints fresh ids, so 'cat' comes back with an id the project has never seen.
const importedLabelNames: LabelName[] = [
    { id: 'imported-cat', name: 'cat', color: '#000', isVisible: true },
    { id: 'imported-dog', name: 'dog', color: '#000', isVisible: true }
];

describe('AnnotationMergeUtil mergeImportedAnnotations method', () => {
    it('should match imported label names by name and keep the ids already in use', () => {
        // given
        const currentImagesData = [createImageData('image-0')];
        const importedImagesData = [createImageData('image-0', [
            createLabelRect('imported-rect-0', 'imported-cat'),
            createLabelRect('imported-rect-1', 'imported-dog')
        ])];

        // when
        const result = AnnotationMergeUtil.mergeImportedAnnotations(
            currentImagesData,
            currentLabelNames,
            {},
            importedImagesData,
            importedLabelNames,
            {}
        );

        // then
        expect(result.labelNames.map((labelName: LabelName) => labelName.id))
            .toEqual(['current-cat', 'imported-dog']);
        expect(result.imagesData[0].labelRects.map((labelRect: LabelRect) => labelRect.labelId))
            .toEqual(['current-cat', 'imported-dog']);
    });

    it('should append the imported annotations to the ones already there', () => {
        // given
        const currentImagesData = [
            createImageData('image-0', [createLabelRect('current-rect-0', 'current-cat')]),
            createImageData('image-1', [createLabelRect('current-rect-1', 'current-cat')])
        ];
        const importedImagesData = [
            createImageData('image-0', [createLabelRect('imported-rect-0', 'imported-dog')]),
            createImageData('image-1')
        ];

        // when
        const result = AnnotationMergeUtil.mergeImportedAnnotations(
            currentImagesData,
            currentLabelNames,
            {},
            importedImagesData,
            importedLabelNames,
            {}
        );

        // then
        expect(result.imagesData[0].labelRects.map((labelRect: LabelRect) => labelRect.id))
            .toEqual(['current-rect-0', 'imported-rect-0']);
        expect(result.imagesData[1].labelRects.map((labelRect: LabelRect) => labelRect.id))
            .toEqual(['current-rect-1']);
    });

    it('should keep the annotations of images the import did not cover', () => {
        // given
        const currentImagesData = [
            createImageData('image-0', [createLabelRect('current-rect-0', 'current-cat')])
        ];

        // when
        const result = AnnotationMergeUtil.mergeImportedAnnotations(
            currentImagesData,
            currentLabelNames,
            {},
            [],
            importedLabelNames,
            {}
        );

        // then
        expect(result.imagesData).toEqual(currentImagesData);
        expect(result.labelNames.map((labelName: LabelName) => labelName.name))
            .toEqual(['cat', 'dog']);
    });

    it('should merge image tags without duplicating them', () => {
        // given
        const currentImagesData = [createImageData('image-0', [], ['current-cat'])];
        const importedImagesData = [
            createImageData('image-0', [], ['imported-cat', 'imported-dog'])
        ];

        // when
        const result = AnnotationMergeUtil.mergeImportedAnnotations(
            currentImagesData,
            currentLabelNames,
            {},
            importedImagesData,
            importedLabelNames,
            {}
        );

        // then
        expect(result.imagesData[0].labelNameIds).toEqual(['current-cat', 'imported-dog']);
    });

    it('should merge measurement functions, the imported ones winning', () => {
        // when
        const result = AnnotationMergeUtil.mergeImportedAnnotations(
            [],
            currentLabelNames,
            {
                width: MeasurementFunctionId.ANGLE,
                height: MeasurementFunctionId.ANGLE
            },
            [],
            importedLabelNames,
            { height: MeasurementFunctionId.PROJECTED_DISTANCE_RATIO }
        );

        // then
        expect(result.measurementFunctionByName).toEqual({
            width: MeasurementFunctionId.ANGLE,
            height: MeasurementFunctionId.PROJECTED_DISTANCE_RATIO
        });
    });
});
