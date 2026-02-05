import { ImageData, LabelPoint, LabelRect } from "../store/labels/types";
import { LabelType } from "../data/enums/LabelType";
import { LabelStatus } from "../data/enums/LabelStatus";
import { ImageFilterMode } from "../data/enums/ImageFilterMode";

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

    public static getFilteredImageIndices(
        imagesData: ImageData[],
        labelType: LabelType,
        filterMode: ImageFilterMode,
        searchText: string
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

                return matchesSearch && matchesFilter;
            })
            .map(({ index }) => index);
    }
}
