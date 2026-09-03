import {
    Annotation,
    ImageData,
    LabelLine,
    LabelName,
    LabelPoint,
    LabelPolygon,
    LabelRect
} from '../store/labels/types';
import { MeasurementFunctionByName } from '../data/measurements/MeasurementFunctionData';
import { uniq } from 'lodash';

export type AnnotationMergeResult = {
    imagesData: ImageData[];
    labelNames: LabelName[];
    measurementFunctionByName: MeasurementFunctionByName;
};

type LabelNamesMergeResult = {
    labelNames: LabelName[];
    labelIdRemap: Map<string, string>;
};

export class AnnotationMergeUtil {
    // Importers mint a fresh id for every label name they read, so a name the project already
    // knows is matched by name and the imported annotations are re-pointed at the id already in
    // use - otherwise the project would end up with two labels sharing a single name.
    private static mergeLabelNames(
        currentLabelNames: LabelName[],
        importedLabelNames: LabelName[]
    ): LabelNamesMergeResult {
        const labelIdByName = new Map<string, string>();
        currentLabelNames.forEach((labelName: LabelName) =>
            labelIdByName.set(labelName.name, labelName.id)
        );

        const labelNames: LabelName[] = [...currentLabelNames];
        const labelIdRemap = new Map<string, string>();

        importedLabelNames.forEach((importedLabelName: LabelName) => {
            const currentLabelId = labelIdByName.get(importedLabelName.name);
            if (currentLabelId) {
                labelIdRemap.set(importedLabelName.id, currentLabelId);
                return;
            }

            labelIdByName.set(importedLabelName.name, importedLabelName.id);
            labelNames.push(importedLabelName);
        });

        return { labelNames, labelIdRemap };
    }

    private static remapLabelId(
        labelId: string | null,
        labelIdRemap: Map<string, string>
    ): string | null {
        return labelId ? (labelIdRemap.get(labelId) || labelId) : labelId;
    }

    private static remapAnnotations<AnnotationType extends Annotation>(
        annotations: AnnotationType[],
        labelIdRemap: Map<string, string>
    ): AnnotationType[] {
        return annotations.map((annotation: AnnotationType) => {
            const labelId = AnnotationMergeUtil.remapLabelId(annotation.labelId, labelIdRemap);
            return labelId === annotation.labelId ? annotation : { ...annotation, labelId };
        });
    }

    // Keeps what the project already holds and adds the imported annotations on top of it. The
    // imported image data is used as the base, since an importer may have filled in fields the
    // project was still missing (image dimensions, load status), and the annotations it read are
    // appended to the ones already there.
    public static mergeImportedAnnotations(
        currentImagesData: ImageData[],
        currentLabelNames: LabelName[],
        currentMeasurementFunctionByName: MeasurementFunctionByName,
        importedImagesData: ImageData[],
        importedLabelNames: LabelName[],
        importedMeasurementFunctionByName: MeasurementFunctionByName = {}
    ): AnnotationMergeResult {
        const { labelNames, labelIdRemap } = AnnotationMergeUtil.mergeLabelNames(
            currentLabelNames,
            importedLabelNames
        );

        const importedImageDataById = new Map<string, ImageData>();
        importedImagesData.forEach((imageData: ImageData) =>
            importedImageDataById.set(imageData.id, imageData)
        );

        const imagesData: ImageData[] = currentImagesData.map((currentImageData: ImageData) => {
            const importedImageData = importedImageDataById.get(currentImageData.id);
            if (!importedImageData) {
                return currentImageData;
            }

            return {
                ...importedImageData,
                labelRects: [
                    ...currentImageData.labelRects,
                    ...AnnotationMergeUtil.remapAnnotations<LabelRect>(
                        importedImageData.labelRects, labelIdRemap
                    )
                ],
                labelPoints: [
                    ...currentImageData.labelPoints,
                    ...AnnotationMergeUtil.remapAnnotations<LabelPoint>(
                        importedImageData.labelPoints, labelIdRemap
                    )
                ],
                labelLines: [
                    ...currentImageData.labelLines,
                    ...AnnotationMergeUtil.remapAnnotations<LabelLine>(
                        importedImageData.labelLines, labelIdRemap
                    )
                ],
                labelPolygons: [
                    ...currentImageData.labelPolygons,
                    ...AnnotationMergeUtil.remapAnnotations<LabelPolygon>(
                        importedImageData.labelPolygons, labelIdRemap
                    )
                ],
                labelNameIds: uniq([
                    ...currentImageData.labelNameIds,
                    ...importedImageData.labelNameIds.map((labelNameId: string) =>
                        AnnotationMergeUtil.remapLabelId(labelNameId, labelIdRemap)
                    )
                ])
            };
        });

        return {
            imagesData,
            labelNames,
            measurementFunctionByName: {
                ...currentMeasurementFunctionByName,
                ...importedMeasurementFunctionByName
            }
        };
    }
}
