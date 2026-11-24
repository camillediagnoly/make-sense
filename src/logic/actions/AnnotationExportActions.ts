import { store } from '../../index';
import { LabelType } from '../../data/enums/LabelType';
import { AnnotationFormatType } from '../../data/enums/AnnotationFormatType';
import { RectLabelsExporter } from '../export/RectLabelsExporter';
import { PolygonLabelsExporter } from '../export/polygon/PolygonLabelsExporter';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { AnnotationMode } from '../../store/labels/types';
import { GeneralSelector } from '../../store/selectors/GeneralSelector';
import { submitNewNotification } from '../../store/notifications/actionCreators';
import { NotificationUtil } from '../../utils/NotificationUtil';
import { ClassSanityCheckUtil } from '../../utils/ClassSanityCheckUtil';

export class AnnotationExportActions {
    // The annotations of the type the project works with (see getExportedLabelType): polygons
    // always go to a COCO JSON file and rectangles to VOC XML files.
    public static exportAnnotations(): void {
        if (AnnotationExportActions.getExportedLabelType() === LabelType.POLYGON) {
            PolygonLabelsExporter.export(AnnotationFormatType.COCO);
        } else {
            RectLabelsExporter.export(AnnotationFormatType.VOC);
        }
        AnnotationExportActions.warnAboutSanityCheckViolations();
    }

    // The imported type, or before any import the type drawn (polygons unless in rectangle mode)
    public static getExportedLabelType(): AnnotationMode {
        return AnnotationExportActions.resolveExportedLabelType(
            LabelsSelector.getAnnotationMode(),
            LabelsSelector.getActiveLabelType()
        );
    }

    public static resolveExportedLabelType(
        annotationMode: AnnotationMode | null,
        activeLabelType: LabelType | null
    ): AnnotationMode {
        if (annotationMode) {
            return annotationMode;
        }
        // polygons are the default, rectangles only in the rectangle mode
        return activeLabelType === LabelType.RECT ? LabelType.RECT : LabelType.POLYGON;
    }

    // The export goes ahead, but the user is told the images breaking the class presence rules
    // can be reviewed from the class sanity check button.
    private static warnAboutSanityCheckViolations(): void {
        const violations = ClassSanityCheckUtil.getImageViolations(
            LabelsSelector.getImagesData(),
            LabelsSelector.getLabelNames(),
            GeneralSelector.getClassSanityCheckSettings()
        );
        if (violations.length === 0) {
            return;
        }

        store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
            header: 'Class sanity check',
            description: `${violations.length} ${violations.length === 1 ? 'image breaks' : 'images break'} ` +
                'the class presence rules. Open the class sanity check to review them.'
        })));
    }
}
