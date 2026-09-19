import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../store/selectors/GeneralSelector';
import { Annotation, ImageData, LabelLine, LabelName, LabelPoint, LabelPolygon, LabelRect } from '../../store/labels/types';
import { filter } from 'lodash';
import { store } from '../../index';
import {
    updateActiveLabelId,
    updateActiveLabelNameId,
    updateImageData,
    updateImageDataById,
    updateLabelVisibility
} from '../../store/labels/actionCreators';
import { updateImageClassCriteria } from '../../store/general/actionCreators';
import { ImageClassExpressionCriteria } from '../../store/general/types';
import { ImageFilterUtil } from '../../utils/ImageFilterUtil';
import { LabelType } from '../../data/enums/LabelType';
import { LabelUtil } from '../../utils/LabelUtil';

export class LabelActions {
    // Per image, the visibility every annotation had when labels were last hidden through
    // "Hide or Restore Labels". Toggling back brings exactly that state back, instead of
    // revealing every label the way "Toggle Labels Visibility" does. An image is absent
    // from the map whenever it is not currently hidden through that shortcut.
    private static visibilitySnapshots: Map<string, Map<string, boolean>> = new Map();

    public static deleteActiveLabel() {
        const activeImageData: ImageData = LabelsSelector.getActiveImageData();
        const activeLabelId: string = LabelsSelector.getActiveLabelId();
        LabelActions.deleteImageLabelById(activeImageData.id, activeLabelId);
    }

    public static deleteImageLabelById(imageId: string, labelId: string) {
        switch (LabelsSelector.getActiveLabelType()) {
            case LabelType.POINT:
                LabelActions.deletePointLabelById(imageId, labelId);
                break;
            case LabelType.RECT:
                LabelActions.deleteRectLabelById(imageId, labelId);
                break;
            case LabelType.POLYGON:
                LabelActions.deletePolygonLabelById(imageId, labelId);
                break;
        }
    }

    public static deleteRectLabelById(imageId: string, labelRectId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        const newImageData = {
            ...imageData,
            labelRects: filter(imageData.labelRects, (currentLabel: LabelRect) => {
                return currentLabel.id !== labelRectId;
            })
        };
        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    public static deletePointLabelById(imageId: string, labelPointId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        const newImageData = {
            ...imageData,
            labelPoints: filter(imageData.labelPoints, (currentLabel: LabelPoint) => {
                return currentLabel.id !== labelPointId;
            })
        };
        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    public static deleteLineLabelById(imageId: string, labelLineId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        const newImageData = {
            ...imageData,
            labelLines: filter(imageData.labelLines, (currentLabel: LabelLine) => {
                return currentLabel.id !== labelLineId;
            })
        };
        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    public static deletePolygonLabelById(imageId: string, labelPolygonId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        const newImageData = {
            ...imageData,
            labelPolygons: filter(imageData.labelPolygons, (currentLabel: LabelPolygon) => {
                return currentLabel.id !== labelPolygonId;
            })
        };
        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    public static toggleMeasurementLabelVisibility() {
        const activeImageData: ImageData = LabelsSelector.getActiveImageData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();

        // Create a map of labelId to label name for easy lookup
        const labelMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name; // label id: label name
            return map;
        }, {});


        const measurementLabelPattern = /^p-[a-z]+\.m:.+/i;
        const measurementAnnotations = activeImageData.labelPolygons.map(annotation => ({
            ...annotation,
            labelName: annotation.labelId ? labelMap[annotation.labelId] || null : null // Find the name based on labelId
        }))
            .filter(annotation => annotation.labelName && measurementLabelPattern.test(annotation.labelName));

        for (let i = 0; i < measurementAnnotations.length; i++) {
            LabelActions.toggleLabelVisibilityById(activeImageData.id, measurementAnnotations[i].id);
        }

    }

    public static toggleLabelVisibilityById(imageId: string, labelId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        const newImageData = {
            ...imageData,
            labelPoints: imageData.labelPoints.map((labelPoint: LabelPoint) => {
                return labelPoint.id === labelId ? LabelUtil.toggleAnnotationVisibility(labelPoint) : labelPoint
            }),
            labelRects: imageData.labelRects.map((labelRect: LabelRect) => {
                return labelRect.id === labelId ? LabelUtil.toggleAnnotationVisibility(labelRect) : labelRect
            }),
            labelPolygons: imageData.labelPolygons.map((labelPolygon: LabelPolygon) => {
                return labelPolygon.id === labelId ? LabelUtil.toggleAnnotationVisibility(labelPolygon) : labelPolygon
            }),
            labelLines: imageData.labelLines.map((labelLine: LabelLine) => {
                return labelLine.id === labelId ? LabelUtil.toggleAnnotationVisibility(labelLine) : labelLine
            }),
        };
        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    public static removeLabelNames(labelNamesIds: string[]) {
        if (!labelNamesIds.length) {
            return;
        }

        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const newImagesData: ImageData[] = LabelUtil.removeLabelNamesFromImagesData(
            imagesData,
            labelNamesIds
        );
        store.dispatch(updateImageData(newImagesData));
        LabelActions.clearRemovedLabelNamesReferences(newImagesData, labelNamesIds);
    }

    // Nothing may keep pointing at a label name, or at an annotation, that has just been deleted.
    private static clearRemovedLabelNamesReferences(
        newImagesData: ImageData[],
        labelNamesIds: string[]
    ) {
        const removedLabelNamesIds = new Set<string>(labelNamesIds);

        const activeLabelNameId: string = LabelsSelector.getActiveLabelNameId();
        if (activeLabelNameId && removedLabelNamesIds.has(activeLabelNameId)) {
            store.dispatch(updateActiveLabelNameId(null));
        }

        const activeLabelId: string | null = LabelsSelector.getActiveLabelId();
        const activeImageIndex: number | null = LabelsSelector.getActiveImageIndex();
        const activeImageData: ImageData | undefined = activeImageIndex !== null
            ? newImagesData[activeImageIndex]
            : undefined;
        if (
            activeLabelId &&
            activeImageData &&
            !LabelUtil.containsAnnotationId(activeImageData, activeLabelId)
        ) {
            store.dispatch(updateActiveLabelId(null));
        }

        const prunedCriteria: ImageClassExpressionCriteria[] | null = ImageFilterUtil
            .removeLabelsFromImageClassCriteria(
                GeneralSelector.getImageClassCriteria(),
                labelNamesIds
            );
        if (prunedCriteria !== null) {
            store.dispatch(updateImageClassCriteria(prunedCriteria));
        }
    }

    public static setLabelVisibilityForLabelName(labelNameId: string, isVisible: boolean) {
        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const newImagesData: ImageData[] = imagesData.map((imageData: ImageData) => ({
            ...imageData,
            labelRects: imageData.labelRects.map((labelRect: LabelRect) =>
                labelRect.labelId === labelNameId ? { ...labelRect, isVisible } : labelRect
            ),
            labelPoints: imageData.labelPoints.map((labelPoint: LabelPoint) =>
                labelPoint.labelId === labelNameId ? { ...labelPoint, isVisible } : labelPoint
            ),
            labelPolygons: imageData.labelPolygons.map((labelPolygon: LabelPolygon) =>
                labelPolygon.labelId === labelNameId ? { ...labelPolygon, isVisible } : labelPolygon
            ),
            labelLines: imageData.labelLines.map((labelLine: LabelLine) =>
                labelLine.labelId === labelNameId ? { ...labelLine, isVisible } : labelLine
            )
        }));
        store.dispatch(updateImageData(newImagesData));
        store.dispatch(updateLabelVisibility(labelNameId, isVisible));
    }

    public static setLabelVisibilityForLabelNames(labelNameIds: string[], isVisible: boolean) {
        if (!labelNameIds.length) {
            return;
        }

        const labelNameIdSet = new Set(labelNameIds);
        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const newImagesData: ImageData[] = imagesData.map((imageData: ImageData) => ({
            ...imageData,
            labelRects: imageData.labelRects.map((labelRect: LabelRect) =>
                labelRect.labelId && labelNameIdSet.has(labelRect.labelId)
                    ? { ...labelRect, isVisible }
                    : labelRect
            ),
            labelPoints: imageData.labelPoints.map((labelPoint: LabelPoint) =>
                labelPoint.labelId && labelNameIdSet.has(labelPoint.labelId)
                    ? { ...labelPoint, isVisible }
                    : labelPoint
            ),
            labelPolygons: imageData.labelPolygons.map((labelPolygon: LabelPolygon) =>
                labelPolygon.labelId && labelNameIdSet.has(labelPolygon.labelId)
                    ? { ...labelPolygon, isVisible }
                    : labelPolygon
            ),
            labelLines: imageData.labelLines.map((labelLine: LabelLine) =>
                labelLine.labelId && labelNameIdSet.has(labelLine.labelId)
                    ? { ...labelLine, isVisible }
                    : labelLine
            )
        }));
        store.dispatch(updateImageData(newImagesData));

        labelNameIds.forEach((labelNameId) => {
            store.dispatch(updateLabelVisibility(labelNameId, isVisible));
        });
    }

    public static toggleLabelNameVisibility(labelNameId: string) {
        const labelNames = LabelsSelector.getLabelNames();
        const labelName = labelNames.find((label) => label.id === labelNameId);
        if (!labelName) return;
        const nextVisibility = !(labelName.isVisible !== false);
        LabelActions.setLabelVisibilityForLabelName(labelNameId, nextVisibility);
    }

    public static labelExistsInLabelNames(label: string): boolean {
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        return labelNames
            .map((labelName: LabelName) => labelName.name)
            .includes(label)
    }


	public static toggleAllLabelsVisibilityInImage(imageId: string) {
    const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
    
    // Determine if we need to show or hide all labels
    // If at least one label is visible, we'll hide all. Otherwise, show all.
    const hasVisibleRects = imageData.labelRects.some((labelRect: LabelRect) => labelRect.isVisible);
    const hasVisiblePoints = imageData.labelPoints.some((labelPoint: LabelPoint) => labelPoint.isVisible);
    const hasVisiblePolygons = imageData.labelPolygons.some((labelPolygon: LabelPolygon) => labelPolygon.isVisible);
    const hasVisibleLines = imageData.labelLines.some((labelLine: LabelLine) => labelLine.isVisible);
    
    const makeAllVisible = !(hasVisibleRects || hasVisiblePoints || hasVisiblePolygons || hasVisibleLines);
    
    const newImageData = {
        ...imageData,
        labelRects: imageData.labelRects.map((labelRect: LabelRect) => ({
            ...labelRect,
            isVisible: makeAllVisible
        })),
        labelPoints: imageData.labelPoints.map((labelPoint: LabelPoint) => ({
            ...labelPoint,
            isVisible: makeAllVisible
        })),
        labelPolygons: imageData.labelPolygons.map((labelPolygon: LabelPolygon) => ({
            ...labelPolygon,
            isVisible: makeAllVisible
        })),
        labelLines: imageData.labelLines.map((labelLine: LabelLine) => ({
            ...labelLine,
            isVisible: makeAllVisible
        }))
    }
    
    store.dispatch(updateImageDataById(imageData.id, newImageData));

    // the image is no longer hidden through the remembering shortcut, so the
    // snapshot it would restore is stale
    LabelActions.visibilitySnapshots.delete(imageData.id);
}

    public static toggleLabelsVisibilityWithRestoreInImage(imageId: string) {
        const imageData: ImageData = LabelsSelector.getImageDataById(imageId);
        if (!imageData) {
            return;
        }

        const snapshot = LabelActions.visibilitySnapshots.get(imageId);
        const newImageData: ImageData = !!snapshot
            ? LabelActions.restoreRememberedVisibility(imageData, snapshot)
            : LabelActions.hideAllLabelsRememberingVisibility(imageData);

        store.dispatch(updateImageDataById(imageData.id, newImageData));
    }

    private static hideAllLabelsRememberingVisibility(imageData: ImageData): ImageData {
        const snapshot: Map<string, boolean> = new Map();
        const hide = <T extends Annotation>(annotations: T[]): T[] =>
            annotations.map((annotation: T) => {
                snapshot.set(annotation.id, annotation.isVisible !== false);
                return { ...annotation, isVisible: false };
            });

        const newImageData: ImageData = {
            ...imageData,
            labelRects: hide(imageData.labelRects),
            labelPoints: hide(imageData.labelPoints),
            labelPolygons: hide(imageData.labelPolygons),
            labelLines: hide(imageData.labelLines)
        };
        LabelActions.visibilitySnapshots.set(imageData.id, snapshot);
        return newImageData;
    }

    private static restoreRememberedVisibility(
        imageData: ImageData,
        snapshot: Map<string, boolean>
    ): ImageData {
        // annotations missing from the snapshot were created while the labels were
        // hidden, so they keep whatever visibility they have now
        const restore = <T extends Annotation>(annotations: T[]): T[] =>
            annotations.map((annotation: T) => snapshot.has(annotation.id)
                ? { ...annotation, isVisible: snapshot.get(annotation.id) }
                : annotation
            );

        const newImageData: ImageData = {
            ...imageData,
            labelRects: restore(imageData.labelRects),
            labelPoints: restore(imageData.labelPoints),
            labelPolygons: restore(imageData.labelPolygons),
            labelLines: restore(imageData.labelLines)
        };
        LabelActions.visibilitySnapshots.delete(imageData.id);
        return newImageData;
    }
}
