import { store } from '../../index';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { updateImageDataById } from '../../store/labels/actionCreators';
import { ImageData, LabelPolygon, LabelRect } from '../../store/labels/types';
import { LabelUtil } from '../../utils/LabelUtil';
import { TagUtil } from '../../utils/TagUtil';

export type AnnotationClipboard = {
    labelRects: LabelRect[];
    labelPolygons: LabelPolygon[];
    tags: string[];
};

// Copies the labelled rectangles, labelled polygons and tags of one image, to paste them on others.
// The clipboard is kept after a paste, so the same annotations can be pasted on several images.
export class AnnotationClipboardActions {
    private static clipboard: AnnotationClipboard | null = null;

    public static getClipboard(): AnnotationClipboard | null {
        return AnnotationClipboardActions.clipboard;
    }

    public static clearClipboard(): void {
        AnnotationClipboardActions.clipboard = null;
    }

    public static copyFromActiveImage(): void {
        const imageData: ImageData | null = LabelsSelector.getActiveImageData();
        if (!imageData) {
            return;
        }
        AnnotationClipboardActions.clipboard = AnnotationClipboardActions.copyFromImage(imageData);
    }

    public static pasteOnActiveImage(): void {
        const imageData: ImageData | null = LabelsSelector.getActiveImageData();
        const clipboard: AnnotationClipboard | null = AnnotationClipboardActions.clipboard;
        if (!imageData || !clipboard) {
            return;
        }
        store.dispatch(updateImageDataById(
            imageData.id,
            AnnotationClipboardActions.pasteOnImage(imageData, clipboard)
        ));
    }

    // Unlabelled annotations are left out: a paste replaces the annotations of the same label.
    public static copyFromImage(imageData: ImageData): AnnotationClipboard {
        return {
            labelRects: (imageData.labelRects || [])
                .filter((labelRect: LabelRect) => !!labelRect.labelId)
                .map((labelRect: LabelRect) => ({...labelRect, rect: {...labelRect.rect}})),
            labelPolygons: (imageData.labelPolygons || [])
                .filter((labelPolygon: LabelPolygon) => !!labelPolygon.labelId)
                .map((labelPolygon: LabelPolygon) => ({
                    ...labelPolygon,
                    vertices: labelPolygon.vertices.map((vertex) => ({...vertex}))
                })),
            tags: [...TagUtil.getImageTags(imageData)]
        };
    }

    // For each label in the clipboard, the image's annotations of that label and type are replaced by
    // the copied ones (all of them, not only the last). Copied tags are added to the image's tags.
    public static pasteOnImage(imageData: ImageData, clipboard: AnnotationClipboard): ImageData {
        const rectLabelIds = new Set<string>(clipboard.labelRects.map((labelRect: LabelRect) => labelRect.labelId));
        const polygonLabelIds = new Set<string>(
            clipboard.labelPolygons.map((labelPolygon: LabelPolygon) => labelPolygon.labelId)
        );
        const imageTags: string[] = TagUtil.getImageTags(imageData);

        return {
            ...imageData,
            labelRects: [
                ...(imageData.labelRects || []).filter((labelRect: LabelRect) => !rectLabelIds.has(labelRect.labelId)),
                ...clipboard.labelRects.map((labelRect: LabelRect) =>
                    LabelUtil.createLabelRect(labelRect.labelId, {...labelRect.rect}))
            ],
            labelPolygons: [
                ...(imageData.labelPolygons || [])
                    .filter((labelPolygon: LabelPolygon) => !polygonLabelIds.has(labelPolygon.labelId)),
                ...clipboard.labelPolygons.map((labelPolygon: LabelPolygon) =>
                    LabelUtil.createLabelPolygon(
                        labelPolygon.labelId,
                        labelPolygon.vertices.map((vertex) => ({...vertex}))
                    ))
            ],
            tags: [...imageTags, ...clipboard.tags.filter((tag: string) => !imageTags.includes(tag))]
        };
    }
}
