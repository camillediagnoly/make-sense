import { store } from "../..";
import { PopupWindowType } from "../../data/enums/PopupWindowType";
import { ContextType } from "../../data/enums/ContextType";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { ProjectType } from "../../data/enums/ProjectType";
import { ImageFilterMode } from "../../data/enums/ImageFilterMode";
import { ClassSanityCheckSettings, ImageClassCriteria } from "../general/types";

export class GeneralSelector {
    public static getActivePopupType(): PopupWindowType {
        return store.getState().general.activePopupType;
    }

    public static getActiveContext(): ContextType {
        return store.getState().general.activeContext;
    }

    public static getPreventCustomCursorStatus(): boolean {
        return store.getState().general.preventCustomCursor;
    }

    public static getImageDragModeStatus(): boolean {
        return store.getState().general.imageDragMode;
    }

    public static getCrossHairVisibleStatus(): boolean {
        return store.getState().general.crossHairVisible;
    }

    public static getFixedZoom(): boolean {
        return store.getState().general.fixedZoom;
    }

    public static getEllipseDrawStatus(): boolean {
        return store.getState().general.ellipseDraw;
    }

    public static getMovingAnnotationStatus(): boolean {
        return store.getState().general.movingAnnotation;
    }

    public static getCopyPolygonsStatus(): boolean {
        return store.getState().general.copyPolygons;
    }

    public static deactivateCopyPolygons(): void {
        store.getState().general.copyPolygons = false;
    }

    public static getPastePolygonsStatus(): boolean {
        return store.getState().general.pastePolygons;
    }

    public static deactivatePastePolygons(): void {
        store.getState().general.pastePolygons = false;
    }

    public static getCustomCursorStyle(): CustomCursorStyle {
        return store.getState().general.customCursorStyle;
    }

    public static getProjectName(): string {
        return store.getState().general.projectData.name;
    }

    public static getProjectType(): ProjectType {
        return store.getState().general.projectData.type;
    }

    public static getZoom(): number {
        return store.getState().general.zoom;
    }

    public static getEnablePerClassColorationStatus(): boolean {
        return store.getState().general.enablePerClassColoration;
    }

    public static getPolygonLassoMode(): boolean {
        return store.getState().general.polygonLassoMode;
    }

    public static getPolygonLassoTargetVertexCount(): number {
        return store.getState().general.polygonLassoTargetVertexCount;
    }

    public static getLineKeypointModeStatus(): boolean {
        return store.getState().general.lineKeypointMode;
    }

    public static getImageListFilterMode(): ImageFilterMode {
        return store.getState().general.imageListFilterMode;
    }

    public static getImageListSearchText(): string {
        return store.getState().general.imageListSearchText;
    }

    public static getKeepLabeledInUnlabeled(): boolean {
        return store.getState().general.keepLabeledInUnlabeled;
    }

    public static getKeptUnlabeledImageIds(): string[] {
        return store.getState().general.keptUnlabeledImageIds;
    }

    public static getImageClassCriteria(): ImageClassCriteria[] {
        return store.getState().general.imageClassCriteria;
    }

    public static getClassSanityCheckSettings(): ClassSanityCheckSettings {
        return store.getState().general.classSanityCheckSettings;
    }

    public static getClassSanityCheckViolationImageIds(): string[] {
        return store.getState().general.classSanityCheckViolationImageIds;
    }

    public static getClassSanityCheckReviewMode(): boolean {
        return store.getState().general.classSanityCheckReviewMode;
    }
}
