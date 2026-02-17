import {
    ImageData,
    LabelLine,
    LabelPoint,
    LabelPolygon,
    LabelRect,
} from "../store/labels/types";
import { LabelType } from "../data/enums/LabelType";
import { LabelStatus } from "../data/enums/LabelStatus";
import { ImageFilterMode } from "../data/enums/ImageFilterMode";
import { ImageClassCriteria } from "../store/general/types";

export class ImageFilterUtil {
    public static isImageLabeled(imageData: ImageData, labelType: LabelType): boolean {
        switch (labelType) {
            case LabelType.LINE:
                return imageData.labelLines.length > 0;
            case LabelType.IMAGE_RECOGNITION:
                return imageData.labelNameIds.length > 0;
            case LabelType.POINT:
                return imageData.labelPoints
                    .filter((labelPoint: LabelPoint) => labelPoint.status === LabelStatus.ACCEPTED)
                    .length > 0;
            case LabelType.POLYGON:
                return imageData.labelPolygons.length > 0;
            case LabelType.RECT:
                return imageData.labelRects
                    .filter((labelRect: LabelRect) => labelRect.status === LabelStatus.ACCEPTED)
                    .length > 0;
            default:
                return false;
        }
    }

    private static getImageAssignedLabelIds(imageData: ImageData): Set<string> {
        const assignedLabelIds = new Set<string>(imageData.labelNameIds || []);

        imageData.labelRects
            .filter(
                (labelRect: LabelRect) =>
                    labelRect.status === LabelStatus.ACCEPTED && !!labelRect.labelId
            )
            .forEach((labelRect: LabelRect) => {
                if (labelRect.labelId) {
                    assignedLabelIds.add(labelRect.labelId);
                }
            });

        imageData.labelPoints
            .filter(
                (labelPoint: LabelPoint) =>
                    labelPoint.status === LabelStatus.ACCEPTED && !!labelPoint.labelId
            )
            .forEach((labelPoint: LabelPoint) => {
                if (labelPoint.labelId) {
                    assignedLabelIds.add(labelPoint.labelId);
                }
            });

        imageData.labelPolygons
            .filter((labelPolygon: LabelPolygon) => !!labelPolygon.labelId)
            .forEach((labelPolygon: LabelPolygon) => {
                if (labelPolygon.labelId) {
                    assignedLabelIds.add(labelPolygon.labelId);
                }
            });

        imageData.labelLines
            .filter((labelLine: LabelLine) => !!labelLine.labelId)
            .forEach((labelLine: LabelLine) => {
                if (labelLine.labelId) {
                    assignedLabelIds.add(labelLine.labelId);
                }
            });

        return assignedLabelIds;
    }

    public static getFilteredImageIndices(
        imagesData: ImageData[],
        labelType: LabelType,
        filterMode: ImageFilterMode,
        searchText: string,
        classCriteria: ImageClassCriteria[] = []
    ): number[] {
        const normalizedSearchText = (searchText || "").toLowerCase();

        return imagesData
            .map((image, index) => ({ image, index }))
            .filter(({ image, index }) => {
                const filename = image.fileData?.name || "";
                const matchesSearch =
                    normalizedSearchText.length === 0 ||
                    filename.toLowerCase().includes(normalizedSearchText);

                let matchesFilter = true;
                if (filterMode === ImageFilterMode.LABELED) {
                    matchesFilter = ImageFilterUtil.isImageLabeled(image, labelType);
                } else if (filterMode === ImageFilterMode.UNLABELED) {
                    matchesFilter = !ImageFilterUtil.isImageLabeled(image, labelType);
                }

                const assignedLabelIds = ImageFilterUtil.getImageAssignedLabelIds(image);
                const activeCriteria = classCriteria.filter(
                    (criteria: ImageClassCriteria) => !!criteria.labelId
                );

                let criteriaResult = true;
                if (activeCriteria.length > 0) {
                    const firstCriteria = activeCriteria[0];
                    criteriaResult = firstCriteria.mode === "include"
                        ? assignedLabelIds.has(firstCriteria.labelId)
                        : !assignedLabelIds.has(firstCriteria.labelId);

                    for (let i = 1; i < activeCriteria.length; i++) {
                        const criteria = activeCriteria[i];
                        const criteriaValue = criteria.mode === "include"
                            ? assignedLabelIds.has(criteria.labelId)
                            : !assignedLabelIds.has(criteria.labelId);

                        criteriaResult = criteria.operator === "and"
                            ? criteriaResult && criteriaValue
                            : criteriaResult || criteriaValue;
                    }
                }

                return matchesSearch && matchesFilter && criteriaResult;
            })
            .map(({ index }) => index);
    }
}
