import {Annotation, ImageData, LabelLine, LabelName, LabelPoint, LabelPolygon, LabelRect} from '../store/labels/types';
import { v4 as uuidv4 } from 'uuid';
import {find} from 'lodash';
import {IRect} from '../interfaces/IRect';
import {LabelStatus} from '../data/enums/LabelStatus';
import {IPoint} from '../interfaces/IPoint';
import { sample } from 'lodash';
import {Settings} from '../settings/Settings';

export class LabelUtil {
    public static createLabelName(name: string): LabelName {
        return {
            id: uuidv4(),
            name,
            color: sample(Settings.LABEL_COLORS_PALETTE),
            isVisible: true
        }
    }

    public static createLabelRect(labelId: string, rect: IRect): LabelRect {
        return {
            id: uuidv4(),
            labelId,
            rect,
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: null
        }
    }

    public static createLabelPolygon(labelId: string, vertices: IPoint[]): LabelPolygon {
        return {
            id: uuidv4(),
            labelId,
            vertices,
            isVisible: true
        }
    }

    public static createLabelPoint(labelId: string, point: IPoint): LabelPoint {
        return {
            id: uuidv4(),
            labelId,
            point,
            isVisible: true,
            isCreatedByAI: false,
            status: LabelStatus.ACCEPTED,
            suggestedLabel: null
        }
    }

    public static toggleAnnotationVisibility<AnnotationType extends Annotation>(annotation: AnnotationType): AnnotationType {
        const currentVisibility = annotation.isVisible !== false;
        return {
            ...annotation,
            isVisible: !currentVisibility
        }
    }

    private static isRemovedLabelInstance(
        labelId: string | null,
        removedLabelNamesIds: Set<string>
    ): boolean {
        return !!labelId && removedLabelNamesIds.has(labelId);
    }

    // Deleting a label name deletes every annotation carrying it, on every image - an annotation
    // pointing at a label name that does not exist anymore would be exported as an unresolvable
    // class. Annotations with no label assigned yet are left untouched.
    public static removeLabelNamesFromImagesData(
        imagesData: ImageData[],
        labelNamesIds: string[]
    ): ImageData[] {
        const removedLabelNamesIds = new Set<string>(labelNamesIds);
        return imagesData.map((imageData: ImageData) => ({
            ...imageData,
            labelRects: imageData.labelRects.filter((labelRect: LabelRect) =>
                !LabelUtil.isRemovedLabelInstance(labelRect.labelId, removedLabelNamesIds)
            ),
            labelPoints: imageData.labelPoints.filter((labelPoint: LabelPoint) =>
                !LabelUtil.isRemovedLabelInstance(labelPoint.labelId, removedLabelNamesIds)
            ),
            labelPolygons: imageData.labelPolygons.filter((labelPolygon: LabelPolygon) =>
                !LabelUtil.isRemovedLabelInstance(labelPolygon.labelId, removedLabelNamesIds)
            ),
            labelLines: imageData.labelLines.filter((labelLine: LabelLine) =>
                !LabelUtil.isRemovedLabelInstance(labelLine.labelId, removedLabelNamesIds)
            ),
            labelNameIds: imageData.labelNameIds.filter((labelNameId: string) =>
                !removedLabelNamesIds.has(labelNameId)
            )
        }));
    }

    // How many annotations (image tags included) removing those label names would delete.
    public static countLabelNamesInstances(
        imagesData: ImageData[],
        labelNamesIds: string[]
    ): number {
        if (!labelNamesIds.length) {
            return 0;
        }

        const removedLabelNamesIds = new Set<string>(labelNamesIds);
        const countInstances = (labelIds: (string | null)[]): number =>
            labelIds.filter((labelId: string | null) =>
                LabelUtil.isRemovedLabelInstance(labelId, removedLabelNamesIds)
            ).length;

        return imagesData.reduce((count: number, imageData: ImageData) =>
            count +
            countInstances(imageData.labelRects.map((label: LabelRect) => label.labelId)) +
            countInstances(imageData.labelPoints.map((label: LabelPoint) => label.labelId)) +
            countInstances(imageData.labelPolygons.map((label: LabelPolygon) => label.labelId)) +
            countInstances(imageData.labelLines.map((label: LabelLine) => label.labelId)) +
            countInstances(imageData.labelNameIds)
        , 0);
    }

    public static containsAnnotationId(imageData: ImageData, annotationId: string): boolean {
        const hasId = (annotation: Annotation): boolean => annotation.id === annotationId;
        return imageData.labelRects.some(hasId) ||
            imageData.labelPoints.some(hasId) ||
            imageData.labelPolygons.some(hasId) ||
            imageData.labelLines.some(hasId);
    }

    public static labelNamesIdsDiff(oldLabelNames: LabelName[], newLabelNames: LabelName[]): string[] {
        return oldLabelNames.reduce((missingIds: string[], labelName: LabelName) => {
            if (!find(newLabelNames, { 'id': labelName.id })) {
                missingIds.push(labelName.id);
            }
            return missingIds
        }, [])
    }
}
