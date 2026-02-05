import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { ImageData, LabelLine, LabelName, LabelPoint, LabelPolygon, LabelRect } from '../../store/labels/types';
import { filter } from 'lodash';
import { store } from '../../index';
import { updateImageData, updateImageDataById, updateLabelVisibility } from '../../store/labels/actionCreators';
import { LabelType } from '../../data/enums/LabelType';
import { LabelUtil } from '../../utils/LabelUtil';

export class LabelActions {
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


        // Map labelId in annotations to the corresponding name and filters only keypoints
        const measurementNames = ['p-b.m:Asym-P', 'p-b.m:Asym-N',
            'p-b.m:Angle-P', 'p-b.m:Angle-N',
            'p-b.m:Position-P', 'p-b.m:Position-N',
            'p-b.m:Surface-P', 'p-b.m:Surface-N',
            'p-e.m:VxAsym-P', 'p-e.m:VxAsym-N',
            'p-e.m:TGA-P', 'p-e.m:TGA-N',
            'p-f.m:CSP-P', 'p-f.m:CSP-N',
            'p-f.m:CI-P', 'p-f.m:CI-N',
        ]

        const measurementAnnotations = activeImageData.labelPolygons.map(annotation => ({
            ...annotation,
            labelName: annotation.labelId ? labelMap[annotation.labelId] || null : null // Find the name based on labelId
        }))
            .filter(annotation => annotation.labelName && measurementNames.includes(annotation.labelName)); // Filter by specific names

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
        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const newImagesData: ImageData[] = imagesData.map((imageData: ImageData) => {
            return LabelActions.removeLabelNamesFromImageData(imageData, labelNamesIds);
        });
        store.dispatch(updateImageData(newImagesData))
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

    private static removeLabelNamesFromImageData(imageData: ImageData, labelNamesIds: string[]): ImageData {
        return {
            ...imageData,
            labelRects: imageData.labelRects.map((labelRect: LabelRect) => {
                if (labelNamesIds.includes(labelRect.id)) {
                    return {
                        ...labelRect,
                        id: null
                    }
                } else {
                    return labelRect
                }
            }),
            labelPoints: imageData.labelPoints.map((labelPoint: LabelPoint) => {
                if (labelNamesIds.includes(labelPoint.id)) {
                    return {
                        ...labelPoint,
                        id: null
                    }
                } else {
                    return labelPoint
                }
            }),
            labelPolygons: imageData.labelPolygons.map((labelPolygon: LabelPolygon) => {
                if (labelNamesIds.includes(labelPolygon.id)) {
                    return {
                        ...labelPolygon,
                        id: null
                    }
                } else {
                    return labelPolygon
                }
            }),
            labelNameIds: imageData.labelNameIds.filter((labelNameId: string) => {
                return !labelNamesIds.includes(labelNameId)
            })
        }
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
}

}
