import { store } from "../../index";
import { conforms, find, min } from "lodash";
import { RectUtil } from "../../utils/RectUtil";
import { updateCustomCursorStyle } from "../../store/general/actionCreators";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { EditorData } from "../../data/EditorData";
import { BaseRenderEngine } from "./BaseRenderEngine";
import { RenderEngineSettings } from "../../settings/RenderEngineSettings";
import { IPoint } from "../../interfaces/IPoint";
import { ILine } from "../../interfaces/ILine";
import { DrawUtil } from "../../utils/DrawUtil";
import { IRect } from "../../interfaces/IRect";
import { ImageData, LabelPolygon, LabelName } from "../../store/labels/types";
import { LabelsSelector } from "../../store/selectors/LabelsSelector";
import {
    updateActiveLabelId,
    updateFirstLabelCreatedFlag,
    updateHighlightedLabelId,
    updateImageDataById,
} from "../../store/labels/actionCreators";
import { LineUtil } from "../../utils/LineUtil";
import { MouseEventUtil } from "../../utils/MouseEventUtil";
import { EventType } from "../../data/enums/EventType";
import { RenderEngineUtil } from "../../utils/RenderEngineUtil";
import { LabelType } from "../../data/enums/LabelType";
import { EditorActions } from "../actions/EditorActions";
import { GeneralSelector } from "../../store/selectors/GeneralSelector";
import { Settings } from "../../settings/Settings";
import { LabelUtil } from "../../utils/LabelUtil";
import { PolygonUtil } from "../../utils/PolygonUtil";
import { start } from "repl";

const asymKeypointNames_B = ["p-b.k:Asym-1", "p-b.k:Asym-2", "p-b.k:Asym-3"];
const angleKeypointNames_B = [
    "p-b.k:Angle-1",
    "p-b.k:Angle-2",
    "p-b.k:Angle-3",
    "p-b.k:Angle-4",
    "p-b.k:Angle-5",
];
const surfaceKeypointNames_B = [
    "p-b.k:Surface-1",
    "p-b.k:Surface-2",
    "p-b.k:Surface-3",
    "p-b.k:Surface-4",
    "p-b.k:Surface-5",
    "p-b.k:Surface-6",
];
const positionKeypointNames_B = [
    "p-b.k:Position-1",
    "p-b.k:Position-2",
    "p-b.k:Position-3",
    "p-b.k:Position-4",
    "p-b.k:Position-5",
];
const veinsKeypointNames_B = [
    "p-b.k:Veins-3",
    "p-b.k:Veins-2",
    "p-b.k:Veins-1",
];
const avKeypointNames_B = ["p-b.k:AVL-1", "p-b.k:AVL-2", "p-b.k:AVL-3"];
const tgaKeypointNames_D = ["p-d.k:TGA-3", "p-d.k:TGA-1", "p-d.k:TGA-2"];
const asymKeypointNames_E = [
    "p-e.k:VxAsym-1",
    "p-e.k:VxAsym-2",
    "p-e.k:VxAsym-3",
    "p-e.k:VxAsym-4",
];
const tgaKeypointNames_E = ["p-e.k:TGA-2", "p-e.k:TGA-1", "p-e.k:TGA-3"];
const asymCSPKeypointNames_F = [
    "p-f.k:CSP-1",
    "p-f.k:CSP-2",
    "p-f.k:CSP-3",
    "p-f.k:CSP-4",
];
const asymCIKeypointNames_F = [
    "p-f.k:CI-1",
    "p-f.k:CI-2",
    "p-f.k:CI-3",
    "p-f.k:CI-4",
];
const angleSFKeypointNames_F = [
    "p-f.k:AngleSF-1",
    "p-f.k:AngleSF-2",
    "p-f.k:AngleSF-3",
];
const ratioSFKeypointNames_F = [
    "p-f.k:RatioSF-1",
    "p-f.k:RatioSF-3",
    "p-f.k:RatioSF-2",
];
const ratioAtrVMGKeypointNames_F = [
    "p-f.k:Vp-3",
    "p-f.k:Vp-4",
    "p-f.k:Vp-1",
    "p-f.k:Vp-2",
];
const ratio4VKeypointNames_G = [
    "p-g.k:4V-1",
    "p-g.k:4V-2",
    "p-g.k:4V-3",
    "p-g.k:4V-4",
];
const allKeypointNames = [
    ...asymKeypointNames_B,
    ...angleKeypointNames_B,
    ...surfaceKeypointNames_B,
    ...positionKeypointNames_B,
    ...veinsKeypointNames_B,
    ...avKeypointNames_B,
    ...tgaKeypointNames_D,
    ...asymKeypointNames_E,
    ...tgaKeypointNames_E,
    ...asymCSPKeypointNames_F,
    ...asymCIKeypointNames_F,
    ...angleSFKeypointNames_F,
    ...ratioSFKeypointNames_F,
    ...ratioAtrVMGKeypointNames_F,
    ...ratio4VKeypointNames_G,
];

const LASSO_MIN_SAMPLE_DISTANCE = 5;
const LASSO_PERIMETER_RATIO = 0.05; // 10%

export class PolygonRenderEngine extends BaseRenderEngine {
    // =================================================================================================================
    // STATE
    // =================================================================================================================

    private activePath: IPoint[] = [];
    private resizeAnchorIndex: number = null;
    private suggestedAnchorPositionOnCanvas: IPoint = null;
    private suggestedAnchorIndexInPolygon: number = null;
    private scaleFactor = 0.005;
    private kptNameEndPattern = /(\d+)$/;

    private keypointUtils = new KeypointUtils();
    private surfaceAnnotator: KeypointSurfaceAnnotation;
    private readonly suffixSetLineColors: string[] = [
        "#00E5FF",
        "#FFEA00",
        "#00FF85",
        "#FF6BFF",
        "#FFA000",
        "#7CFF00",
        "#40C4FF",
        "#FF5252",
    ];
    public isDrawingEllipse: boolean;
    public isMovingAnnotation: boolean;
    public copyPolygons: boolean;
    public copyTwoPolygons: boolean;
    public copyThreePolygons: boolean;
    public pastePolygons: boolean = true;
    public annotationsInMemory: LabelPolygon[] = [];
    // State to track dragging
    private draggingPolygon: LabelPolygon = null;
    private dragOffset: IPoint = null;
    private isLassoDrawing: boolean = false;
    private lastLassoPoint: IPoint = null;
    private lassoHadContactSinceStart: boolean = false;

    public constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.labelType = LabelType.POLYGON;
        this.surfaceAnnotator = new KeypointSurfaceAnnotation();
    }

    private buildRenderableKeypointCenterMap(): Map<
        string,
        Map<string, { id: string; labelName: string; centroid: IPoint }>
    > {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const labelMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name;
            return map;
        }, {});
        const centerMap = new Map<
            string,
            Map<string, { id: string; labelName: string; centroid: IPoint }>
        >();
        const sortedBaseNames = [...allKeypointNames].sort(
            (a, b) => b.length - a.length,
        );

        imageData.labelPolygons
            .filter((annotation) => annotation.isVisible)
            .forEach((annotation) => {
                const labelName = annotation.labelId
                    ? labelMap[annotation.labelId] || null
                    : null;
                if (!labelName) {
                    return;
                }

                const baseLabelName =
                    sortedBaseNames.find(
                        (baseName) =>
                            labelName === baseName ||
                            labelName.startsWith(baseName),
                    ) || null;
                if (!baseLabelName) {
                    return;
                }

                const suffix = labelName.slice(baseLabelName.length);
                const perBaseMap =
                    centerMap.get(baseLabelName) ||
                    new Map<
                        string,
                        { id: string; labelName: string; centroid: IPoint }
                    >();
                perBaseMap.set(suffix, {
                    id: annotation.id,
                    labelName,
                    centroid: this.keypointUtils.computeCentroid(annotation),
                });
                centerMap.set(baseLabelName, perBaseMap);
            });

        return centerMap;
    }

    private drawLineBetweenKeypointCenters(
        startCenter: IPoint,
        endCenter: IPoint,
        lineColor: string,
        data: EditorData,
    ): void {
        const lineToDraw: ILine = {
            start: startCenter,
            end: endCenter,
        };
        const lineOnCanvas =
            RenderEngineUtil.transferLineFromImageToViewPortContent(
                lineToDraw,
                data,
            );
        const standardizedLine: ILine = {
            start: RenderEngineUtil.setPointBetweenPixels(lineOnCanvas.start),
            end: RenderEngineUtil.setPointBetweenPixels(lineOnCanvas.end),
        };
        DrawUtil.drawLine(
            this.canvas,
            standardizedLine.start,
            standardizedLine.end,
            lineColor,
            RenderEngineSettings.LINE_THICKNESS,
        );
    }

    private resolveLineColorBySuffix(suffix: string): string {
        if (!suffix) {
            return RenderEngineSettings.defaultAnchorColor;
        }
        const colorIndex =
            this.getStableStringHash(suffix) % this.suffixSetLineColors.length;
        return this.suffixSetLineColors[colorIndex];
    }

    private getStableStringHash(value: string): number {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        }
        return hash;
    }

    private drawKeypointLinesForSequence(
        keypointNameSequence: string[],
        step: number,
        keypointCenterMap: Map<
            string,
            Map<string, { id: string; labelName: string; centroid: IPoint }>
        >,
        data: EditorData,
    ): void {
        for (let i = 0; i < keypointNameSequence.length - 1; i += step) {
            const startBaseName = keypointNameSequence[i];
            const endBaseName = keypointNameSequence[i + 1];
            const startBySuffix = keypointCenterMap.get(startBaseName);
            const endBySuffix = keypointCenterMap.get(endBaseName);
            if (!startBySuffix || !endBySuffix) {
                continue;
            }

            startBySuffix.forEach((startPointData, suffix) => {
                const endPointData = endBySuffix.get(suffix);
                if (!endPointData) {
                    return;
                }
                const lineColor = this.resolveLineColorBySuffix(suffix);
                this.drawLineBetweenKeypointCenters(
                    startPointData.centroid,
                    endPointData.centroid,
                    lineColor,
                    data,
                );
            });
        }
    }

    private drawSurfaceEllipsesForSequence(
        keypointNameSequence: string[],
        keypointCenterMap: Map<
            string,
            Map<string, { id: string; labelName: string; centroid: IPoint }>
        >,
        data: EditorData,
    ): void {
        for (let i = 0; i < keypointNameSequence.length - 2; i += 3) {
            const firstBaseName = keypointNameSequence[i];
            const secondBaseName = keypointNameSequence[i + 1];
            const thirdBaseName = keypointNameSequence[i + 2];
            const firstBySuffix = keypointCenterMap.get(firstBaseName);
            const secondBySuffix = keypointCenterMap.get(secondBaseName);
            const thirdBySuffix = keypointCenterMap.get(thirdBaseName);
            if (!firstBySuffix || !secondBySuffix || !thirdBySuffix) {
                continue;
            }

            firstBySuffix.forEach((firstPointData, suffix) => {
                const secondPointData = secondBySuffix.get(suffix);
                const thirdPointData = thirdBySuffix.get(suffix);
                if (!secondPointData || !thirdPointData) {
                    return;
                }

                const pointsOnCanvas =
                    RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                        [
                            firstPointData.centroid,
                            secondPointData.centroid,
                            thirdPointData.centroid,
                        ],
                        data,
                    );
                const startPoint = RenderEngineUtil.setPointBetweenPixels(
                    pointsOnCanvas[0],
                );
                const endPoint = RenderEngineUtil.setPointBetweenPixels(
                    pointsOnCanvas[1],
                );
                const constrainPoint = RenderEngineUtil.setPointBetweenPixels(
                    pointsOnCanvas[2],
                );
                const ellipseColor = this.resolveLineColorBySuffix(suffix);
                this.surfaceAnnotator.drawEllipse(
                    this.canvas,
                    startPoint,
                    endPoint,
                    constrainPoint,
                    ellipseColor,
                );
            });
        }
    }

    // =================================================================================================================
    // EVENT HANDLERS
    // =================================================================================================================
    // Handle mouse down for dragging
    private handleMouseDownForDragging(data: EditorData): void {
        const polygonUnderMouse = this.getPolygonUnderMouse(data);
        if (!!polygonUnderMouse) {
            this.draggingPolygon = polygonUnderMouse;
            const mousePosition: IPoint = data.mousePositionOnViewPortContent;
            const polygonCenter: IPoint =
                RenderEngineUtil.transferPointFromImageToViewPortContent(
                    this.keypointUtils.computeCentroid(this.draggingPolygon),
                    data,
                );
            this.dragOffset = {
                x: mousePosition.x - polygonCenter.x,
                y: mousePosition.y - polygonCenter.y,
            };
        }
    }

    // Handle mouse move for dragging
    private handleMouseMoveForDragging(data: EditorData): void {
        if (!!this.draggingPolygon) {
            const mousePosition: IPoint = data.mousePositionOnViewPortContent;
            const currPolygon: LabelPolygon = {
                ...this.draggingPolygon,
                vertices:
                    RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                        this.draggingPolygon.vertices,
                        data,
                    ),
            };
            const currPolygonCenter: IPoint =
                this.keypointUtils.computeCentroid(currPolygon);
            const newVertices = currPolygon.vertices.map((vertex) => ({
                x:
                    vertex.x -
                    currPolygonCenter.x +
                    (mousePosition.x - this.dragOffset.x),
                y:
                    vertex.y -
                    currPolygonCenter.y +
                    (mousePosition.y - this.dragOffset.y),
            }));
            this.updatePolygonVertices(
                this.draggingPolygon.id,
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    newVertices,
                    data,
                ),
            );
        }
    }

    // Handle mouse up to stop dragging
    private handleMouseUpForDragging(): void {
        this.draggingPolygon = null;
        this.dragOffset = null;
    }

    // Update polygon vertices
    private updatePolygonVertices(
        polygonId: string,
        newVertices: IPoint[],
    ): void {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        imageData.labelPolygons = imageData.labelPolygons.map((polygon) => {
            if (polygon.id === polygonId) {
                return { ...polygon, vertices: newVertices };
            }
            return polygon;
        });
        store.dispatch(updateImageDataById(imageData.id, imageData));
    }

    public update(data: EditorData): void {
        if (!!data.event) {
            switch (MouseEventUtil.getEventType(data.event)) {
                case EventType.MOUSE_MOVE:
                    this.mouseMoveHandler(data);
                    break;
                case EventType.MOUSE_UP:
                    this.mouseUpHandler(data);
                    break;
                case EventType.MOUSE_DOWN:
                    this.mouseDownHandler(data);
                    break;
                default:
                    break;
            }
        }
    }

    public mouseDownHandler(data: EditorData): void {
        const mouseEvent: MouseEvent = data.event as MouseEvent;
        const isRightClick: boolean = mouseEvent && mouseEvent.button === 2;
        const isLeftClick: boolean = !mouseEvent || mouseEvent.button === 0;
        const isMouseOverCanvas: boolean =
            RenderEngineUtil.isMouseOverCanvas(data);
        if (isMouseOverCanvas) {
            if (isRightClick) {
                if (this.isCreationInProgress()) {
                    this.toggleLassoDrawingMode();
                }
                return;
            }

            if (!isLeftClick) {
                return;
            }

            if (this.isCreationInProgress()) {
                if (this.isLassoDrawing) {
                    this.addPointFromLasso(data, true);
                    this.addLabelAndFinishCreation(data);
                    return;
                }
                const isMouseOverStartAnchor: boolean = this.isMouseOverAnchor(
                    data.mousePositionOnViewPortContent,
                    this.activePath[0],
                );
                if (isMouseOverStartAnchor) {
                    this.addLabelAndFinishCreation(data);
                } else {
                    this.updateActivelyCreatedLabel(data);
                }
            } else {
                const polygonUnderMouse: LabelPolygon =
                    this.getPolygonUnderMouse(data);
                if (!!polygonUnderMouse) {
                    if (this.isMovingAnnotation) {
                        this.handleMouseDownForDragging(data); // Add dragging logic here
                    } else {
                        const anchorIndex: number =
                            polygonUnderMouse.vertices.reduce(
                                (
                                    indexUnderMouse: number,
                                    anchor: IPoint,
                                    index: number,
                                ) => {
                                    if (indexUnderMouse === null) {
                                        const anchorOnCanvas: IPoint =
                                            RenderEngineUtil.transferPointFromImageToViewPortContent(
                                                anchor,
                                                data,
                                            );
                                        if (
                                            this.isMouseOverAnchor(
                                                data.mousePositionOnViewPortContent,
                                                anchorOnCanvas,
                                            )
                                        ) {
                                            return index;
                                        }
                                    }
                                    return indexUnderMouse;
                                },
                                null,
                            );

                        if (anchorIndex !== null) {
                            this.startExistingLabelResize(
                                data,
                                polygonUnderMouse.id,
                                anchorIndex,
                            );
                        } else {
                            store.dispatch(
                                updateActiveLabelId(polygonUnderMouse.id),
                            );
                            const isMouseOverNewAnchor: boolean =
                                this.isMouseOverAnchor(
                                    data.mousePositionOnViewPortContent,
                                    this.suggestedAnchorPositionOnCanvas,
                                );
                            if (isMouseOverNewAnchor) {
                                this.addSuggestedAnchorToPolygonLabel(data);
                            }
                        }
                    }
                } else {
                    this.updateActivelyCreatedLabel(data);
                }
            }
        }
    }

    public mouseUpHandler(data: EditorData): void {
        if (this.isResizeInProgress()) {
            this.endExistingLabelResize(data);
        } else if (this.draggingPolygon) {
            this.handleMouseUpForDragging();
        } else if (this.shouldFinishLassoCreationOnPointerUp(data)) {
            this.addPointFromLasso(data, true);
            this.addLabelAndFinishCreation(data);
        }
    }

    public mouseMoveHandler(data: EditorData): void {
        if (
            !!data.viewPortContentImageRect &&
            !!data.mousePositionOnViewPortContent
        ) {
            if (this.isCreationInProgress() && this.isLassoDrawing) {
                this.updateLassoContactState(data.event);
                this.addPointFromLasso(data);
                if (this.shouldFinishLassoCreationFromMoveRelease(data)) {
                    this.addPointFromLasso(data, true);
                    this.addLabelAndFinishCreation(data);
                    return;
                }
            }
            const isOverImage: boolean =
                RenderEngineUtil.isMouseOverImage(data);
            if (isOverImage && !this.isCreationInProgress()) {
                const labelPolygon: LabelPolygon =
                    this.getPolygonUnderMouse(data);
                if (!!this.draggingPolygon) {
                    this.handleMouseMoveForDragging(data); // Add dragging logic here
                } else {
                    if (!!labelPolygon && !this.isResizeInProgress()) {
                        if (
                            LabelsSelector.getHighlightedLabelId() !==
                            labelPolygon.id
                        ) {
                            store.dispatch(
                                updateHighlightedLabelId(labelPolygon.id),
                            );
                        }
                        const pathOnCanvas: IPoint[] =
                            RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                                labelPolygon.vertices,
                                data,
                            );
                        const linesOnCanvas: ILine[] =
                            PolygonUtil.getEdges(pathOnCanvas);

                        for (let j = 0; j < linesOnCanvas.length; j++) {
                            const mouseOverLine =
                                RenderEngineUtil.isMouseOverLine(
                                    data.mousePositionOnViewPortContent,
                                    linesOnCanvas[j],
                                    RenderEngineSettings.anchorHoverSize.width /
                                        2,
                                );
                            if (mouseOverLine) {
                                this.suggestedAnchorPositionOnCanvas =
                                    LineUtil.getCenter(linesOnCanvas[j]);
                                this.suggestedAnchorIndexInPolygon = j + 1;
                                break;
                            }
                        }
                    } else {
                        if (LabelsSelector.getHighlightedLabelId() !== null) {
                            store.dispatch(updateHighlightedLabelId(null));
                            this.discardSuggestedPoint();
                        }
                    }
                }
            }
        }
    }

    private removeLastPoint(): void {
        if (this.isCreationInProgress() && this.activePath.length > 0) {
            this.activePath.pop();
            if (this.isLassoDrawing) {
                this.lastLassoPoint =
                    this.activePath.length > 0
                        ? this.activePath[this.activePath.length - 1]
                        : null;
            }
        }
    }

    public undoLastAddedPoint(): void {
        if (this.isCreationInProgress()) {
            this.removeLastPoint();
            EditorActions.fullRender();
        }
    }

    // =================================================================================================================
    // RENDERING
    // =================================================================================================================

    public render(data: EditorData): void {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        this.isDrawingEllipse = GeneralSelector.getEllipseDrawStatus();
        this.isMovingAnnotation = GeneralSelector.getMovingAnnotationStatus();
        this.copyPolygons = GeneralSelector.getCopyPolygonsStatus();
        this.pastePolygons = GeneralSelector.getPastePolygonsStatus();

        if (imageData) {
            this.drawExistingLabels(data);
            this.drawActivelyCreatedLabel(data);
            this.drawActivelyResizeLabel(data);
            this.updateCursorStyle(data);
            this.drawSuggestedAnchor(data);
            this.copyAndPasteAnnotations(data);
        }
    }

    private updateCursorStyle(data: EditorData) {
        if (
            !!this.canvas &&
            !!data.mousePositionOnViewPortContent &&
            !GeneralSelector.getImageDragModeStatus()
        ) {
            const isMouseOverCanvas: boolean =
                RenderEngineUtil.isMouseOverCanvas(data);
            if (isMouseOverCanvas) {
                if (this.isCreationInProgress()) {
                    const isMouseOverStartAnchor: boolean =
                        this.isMouseOverAnchor(
                            data.mousePositionOnViewPortContent,
                            this.activePath[0],
                        );
                    if (isMouseOverStartAnchor && this.activePath.length > 2)
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.CLOSE),
                        );
                    else
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.DEFAULT),
                        );
                } else {
                    const anchorUnderMouse: IPoint =
                        this.getAnchorUnderMouse(data);
                    const isMouseOverNewAnchor: boolean =
                        this.isMouseOverAnchor(
                            data.mousePositionOnViewPortContent,
                            this.suggestedAnchorPositionOnCanvas,
                        );
                    if (!!isMouseOverNewAnchor) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.ADD),
                        );
                    } else if (this.isResizeInProgress()) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.MOVE),
                        );
                    } else if (!!anchorUnderMouse) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.MOVE),
                        );
                    } else {
                        RenderEngineUtil.wrapDefaultCursorStyleInCancel(data);
                    }
                }
                this.canvas.style.cursor = "none";
            } else {
                this.canvas.style.cursor = "default";
            }
        }
    }

    private drawActivelyCreatedLabel(data: EditorData) {
        const standardizedPoints: IPoint[] = this.activePath.map(
            (point: IPoint) => RenderEngineUtil.setPointBetweenPixels(point),
        );
        const path = standardizedPoints.concat(
            data.mousePositionOnViewPortContent,
        );
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(
            null,
            true,
        );
        DrawUtil.drawPolygonWithFill(
            this.canvas,
            path,
            DrawUtil.hexToRGB(lineColor, 0.2),
        );
        DrawUtil.drawDashedPolygon(
            this.canvas,
            path,
            lineColor,
            RenderEngineSettings.LINE_THICKNESS,
            [8, 4],
            false,
        );
        if (this.isDrawingEllipse)
            this.surfaceAnnotator.processAnnotation(
                this.canvas,
                data,
                standardizedPoints,
            );
    }

    private drawActivelyResizeLabel(data: EditorData) {
        const activeLabelPolygon: LabelPolygon =
            LabelsSelector.getActivePolygonLabel();
        if (!!activeLabelPolygon && this.isResizeInProgress()) {
            const snappedMousePosition: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect,
            );
            const polygonOnCanvas: IPoint[] = activeLabelPolygon.vertices.map(
                (point: IPoint, index: number) => {
                    return index === this.resizeAnchorIndex
                        ? snappedMousePosition
                        : RenderEngineUtil.transferPointFromImageToViewPortContent(
                              point,
                              data,
                          );
                },
            );
            this.drawPolygon(activeLabelPolygon.labelId, polygonOnCanvas, true);
        }
    }

    private drawExistingLabels(data: EditorData) {
        const activeLabelId: string = LabelsSelector.getActiveLabelId();
        const highlightedLabelId: string =
            LabelsSelector.getHighlightedLabelId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();

        imageData.labelPolygons.forEach((labelPolygon: LabelPolygon) => {
            if (labelPolygon.isVisible !== false) {
                const isActive: boolean =
                    labelPolygon.id === activeLabelId ||
                    labelPolygon.id === highlightedLabelId;
                const pathOnCanvas: IPoint[] =
                    RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                        labelPolygon.vertices,
                        data,
                    );
                if (
                    !(
                        labelPolygon.id === activeLabelId &&
                        this.isResizeInProgress()
                    )
                ) {
                    this.drawPolygon(
                        labelPolygon.labelId,
                        pathOnCanvas,
                        isActive,
                    );
                }
            }
        });

        // Create a map of keypoints' centers for rendering.
        const renderableKeypointCenterMap =
            this.buildRenderableKeypointCenterMap();
        const keypointNamesPairedToDrawLine = [
            ...angleKeypointNames_B.slice(0, -1),
            ...positionKeypointNames_B.slice(0, 2),
            ...asymKeypointNames_E,
            ...tgaKeypointNames_E.slice(0, 2),
            ...asymCSPKeypointNames_F,
            ...asymCIKeypointNames_F,
            ...ratioAtrVMGKeypointNames_F,
            ...ratio4VKeypointNames_G,
        ];
        this.drawKeypointLinesForSequence(
            keypointNamesPairedToDrawLine,
            2,
            renderableKeypointCenterMap,
            data,
        );

        const keypointNamesUnPairedToDrawLine = [
            ...asymKeypointNames_B,
            ...veinsKeypointNames_B,
            "p-b.k:Veins-3",
            ...avKeypointNames_B,
            ...angleSFKeypointNames_F,
            ...ratioSFKeypointNames_F,
        ];
        this.drawKeypointLinesForSequence(
            keypointNamesUnPairedToDrawLine,
            1,
            renderableKeypointCenterMap,
            data,
        );

        // Create a map of keypoints' centers for Surface annotations.
        const keypointNamesSurfaceAndPositionB = [
            ...surfaceKeypointNames_B,
            ...positionKeypointNames_B.slice(2),
        ];
        this.drawSurfaceEllipsesForSequence(
            keypointNamesSurfaceAndPositionB,
            renderableKeypointCenterMap,
            data,
        );

        //
        // const [positionRatio_B, _ellipsePointsForRatio] = this.keypointUtils.computePositionRatio(allKeypointCenters, positionKeypointNames_B);
        // const ellipsePointsForRatio = _ellipsePointsForRatio.map(([x, y]) => ({ x, y }));
        // const ellipsePointsForRatioOnCanva = RenderEngineUtil.transferPolygonFromImageToViewPortContent(ellipsePointsForRatio, data);
        // const standardizedEllipsePoints: IPoint[] = ellipsePointsForRatioOnCanva.map((point: IPoint) => RenderEngineUtil.setPointBetweenPixels(point));
        // const anchorColor: string = BaseRenderEngine.resolveLabelAnchorColor(true);
        // standardizedEllipsePoints.forEach((point: IPoint) => {
        //     DrawUtil.drawCircleWithFill(this.canvas, point, Settings.RESIZE_HANDLE_DIMENSION_PX / 2, anchorColor);
        // })
    }

    private drawPolygon(
        labelId: string | null,
        polygon: IPoint[],
        isActive: boolean,
    ) {
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(
            labelId,
            true,
        );
        const anchorColor: string =
            BaseRenderEngine.resolveLabelAnchorColor(true);
        const standardizedPoints: IPoint[] = polygon.map((point: IPoint) =>
            RenderEngineUtil.setPointBetweenPixels(point),
        );
        if (isActive) {
            DrawUtil.drawPolygonWithFill(
                this.canvas,
                standardizedPoints,
                DrawUtil.hexToRGB(lineColor, 0.2),
            );
        }
        DrawUtil.drawPolygon(
            this.canvas,
            standardizedPoints,
            lineColor,
            RenderEngineSettings.LINE_THICKNESS,
        );
        if (isActive) {
            standardizedPoints.forEach((point: IPoint) => {
                DrawUtil.drawCircleWithFill(
                    this.canvas,
                    point,
                    Settings.RESIZE_HANDLE_DIMENSION_PX / 2,
                    anchorColor,
                );
            });
        }
    }

    private drawSuggestedAnchor(data: EditorData) {
        const anchorColor: string =
            BaseRenderEngine.resolveLabelAnchorColor(true);
        if (this.suggestedAnchorPositionOnCanvas) {
            const suggestedAnchorRect: IRect =
                RectUtil.getRectWithCenterAndSize(
                    this.suggestedAnchorPositionOnCanvas,
                    RenderEngineSettings.suggestedAnchorDetectionSize,
                );
            const isMouseOverSuggestedAnchor: boolean = RectUtil.isPointInside(
                suggestedAnchorRect,
                data.mousePositionOnViewPortContent,
            );

            if (isMouseOverSuggestedAnchor) {
                DrawUtil.drawCircleWithFill(
                    this.canvas,
                    this.suggestedAnchorPositionOnCanvas,
                    Settings.RESIZE_HANDLE_DIMENSION_PX / 2,
                    anchorColor,
                );
            }
        }
    }

    // =================================================================================================================
    // CREATION
    // =================================================================================================================

    private arePointsClose(
        a: IPoint,
        b: IPoint,
        tolerance: number = 1,
    ): boolean {
        return (
            Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
        );
    }

    private getLineKeypointGroupSizeForActiveLabel(): number | null {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        if (!activeLabelId) return null;
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const label = labelNames.find((l) => l.id === activeLabelId);
        if (!label) return null;
        const group = this.findKeypointGroup(label.name);
        return group ? group.length : null;
    }

    private updateActivelyCreatedLabel(data: EditorData) {
        if (this.isCreationInProgress()) {
            if (GeneralSelector.getLineKeypointModeStatus()) {
                const maxPoints = this.getLineKeypointGroupSizeForActiveLabel();
                if (maxPoints !== null && this.activePath.length >= maxPoints) {
                    return;
                }
                // Double-click at same position with 1 existing point → finish as single keypoint
                if (this.activePath.length === 1) {
                    const mousePositionSnapped: IPoint =
                        RectUtil.snapPointToRect(
                            data.mousePositionOnViewPortContent,
                            data.viewPortContentImageRect,
                        );
                    if (
                        this.arePointsClose(
                            this.activePath[0],
                            mousePositionSnapped,
                        )
                    ) {
                        this.addLabelAndFinishCreation(data);
                        return;
                    }
                }
            }
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect,
            );
            this.activePath.push(mousePositionSnapped);
        } else {
            const isMouseOverImage: boolean = RectUtil.isPointInside(
                data.viewPortContentImageRect,
                data.mousePositionOnViewPortContent,
            );
            if (isMouseOverImage) {
                EditorActions.setViewPortActionsDisabledStatus(true);
                this.activePath.push(data.mousePositionOnViewPortContent);
                store.dispatch(updateActiveLabelId(null));
                this.applyPreferredCreationMode();
            }
        }
    }

    private toggleLassoDrawingMode(): void {
        if (this.isLassoDrawing) {
            this.stopLassoDrawingMode();
        } else {
            this.startLassoDrawingMode();
        }
    }

    private startLassoDrawingMode(): void {
        if (!this.isCreationInProgress() || this.activePath.length === 0)
            return;
        this.isLassoDrawing = true;
        this.lassoHadContactSinceStart = false;
        const lastPoint = this.activePath[this.activePath.length - 1];
        this.lastLassoPoint = lastPoint
            ? { x: lastPoint.x, y: lastPoint.y }
            : null;
    }

    private stopLassoDrawingMode(): void {
        this.isLassoDrawing = false;
        this.lassoHadContactSinceStart = false;
        this.lastLassoPoint = null;
    }

    private updateLassoContactState(event?: Event): void {
        if (!event || !this.isLassoDrawing || !this.isCreationInProgress()) {
            return;
        }

        if (this.isInputInContact(event)) {
            this.lassoHadContactSinceStart = true;
        }
    }

    private shouldFinishLassoCreationFromMoveRelease(
        data: EditorData,
    ): boolean {
        if (
            !this.lassoHadContactSinceStart ||
            !this.isLassoDrawing ||
            !this.isCreationInProgress()
        ) {
            return false;
        }

        const eventType = data.event?.type;
        if (
            eventType !== EventType.POINTER_MOVE &&
            eventType !== EventType.MOUSE_MOVE &&
            eventType !== EventType.TOUCH_MOVE
        ) {
            return false;
        }

        return !this.isInputInContact(data.event);
    }

    private shouldFinishLassoCreationOnPointerUp(data: EditorData): boolean {
        if (!this.isLassoDrawing || !this.isCreationInProgress()) {
            return false;
        }

        const hasPointerEvents =
            typeof window !== "undefined" && "PointerEvent" in window;
        const hasTouchCapability =
            typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
        const eventType = data.event?.type;
        if (eventType === EventType.TOUCH_END) {
            return this.activePath.length > 0;
        }

        if (
            eventType === EventType.POINTER_UP ||
            eventType === EventType.POINTER_CANCEL
        ) {
            const pointerEvent = data.event as PointerEvent;
            if (pointerEvent.pointerType !== "mouse") {
                return this.activePath.length > 0;
            }

            // Some tablet browsers report stylus as "mouse"; allow close on touch-capable devices.
            return hasTouchCapability && this.activePath.length > 0;
        }

        if (eventType === EventType.MOUSE_UP) {
            const mouseEvent = data.event as MouseEvent & {
                sourceCapabilities?: { firesTouchEvents?: boolean };
            };
            const fromTouchCompatMouse =
                !!mouseEvent.sourceCapabilities?.firesTouchEvents;

            // Fallback for tablets/browsers that emit compatibility mouse events for pen/touch.
            if (
                (!hasPointerEvents ||
                    hasTouchCapability ||
                    fromTouchCompatMouse) &&
                this.lassoHadContactSinceStart
            ) {
                return this.activePath.length > 0;
            }
        }

        return false;
    }

    private isInputInContact(event: Event): boolean {
        if (!event) {
            return false;
        }

        const pointerEvent = event as PointerEvent;
        if (typeof pointerEvent.pointerType === "string") {
            if (pointerEvent.pointerType === "touch") {
                return true;
            }
            return (
                (pointerEvent.buttons || 0) > 0 ||
                (pointerEvent.pressure || 0) > 0
            );
        }

        const touchEvent = event as TouchEvent;
        if (touchEvent.touches) {
            return touchEvent.touches.length > 0;
        }

        const mouseEvent = event as MouseEvent;
        if (typeof mouseEvent.buttons === "number") {
            return mouseEvent.buttons > 0;
        }

        return false;
    }

    private applyPreferredCreationMode(): void {
        if (!this.isCreationInProgress()) return;
        const preferLasso = GeneralSelector.getPolygonLassoMode();
        if (preferLasso) {
            this.startLassoDrawingMode();
        } else {
            this.stopLassoDrawingMode();
        }
    }

    private addPointFromLasso(data: EditorData, force: boolean = false): void {
        if (!this.isLassoDrawing || !this.isCreationInProgress()) return;
        const { viewPortContentImageRect, mousePositionOnViewPortContent } =
            data;
        if (!viewPortContentImageRect || !mousePositionOnViewPortContent)
            return;

        const snappedPoint = RectUtil.snapPointToRect(
            mousePositionOnViewPortContent,
            viewPortContentImageRect,
        );
        if (!snappedPoint) return;

        const normalizedPoint: IPoint = {
            x: snappedPoint.x,
            y: snappedPoint.y,
        };

        if (!this.lastLassoPoint) {
            this.lastLassoPoint = normalizedPoint;
            if (this.activePath.length === 0) {
                this.activePath.push(normalizedPoint);
            }
            return;
        }

        const dx = normalizedPoint.x - this.lastLassoPoint.x;
        const dy = normalizedPoint.y - this.lastLassoPoint.y;
        const distance = Math.hypot(dx, dy);

        if (!force && distance < LASSO_MIN_SAMPLE_DISTANCE) {
            return;
        }

        if (force && distance === 0) {
            return;
        }

        this.activePath.push(normalizedPoint);
        this.lastLassoPoint = normalizedPoint;
    }

    private prepareActivePathForSaving(): IPoint[] {
        if (!this.activePath || this.activePath.length === 0) {
            return [];
        }
        if (this.isLassoDrawing) {
            const spacing = this.calculateLassoSpacing(this.activePath);
            const resampled = this.resamplePath(this.activePath, spacing);
            if (resampled.length >= 3) {
                return resampled;
            }
        }
        return this.activePath.map((point: IPoint) => ({ ...point }));
    }

    private calculateLassoSpacing(points: IPoint[]): number {
        const pathLength = this.calculatePathLength(points);
        if (pathLength <= 0) {
            return 1;
        }

        return pathLength * LASSO_PERIMETER_RATIO;
    }

    private calculatePathLength(points: IPoint[]): number {
        if (!points || points.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            total += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        }
        // include closing segment
        const first = points[0];
        const last = points[points.length - 1];
        total += Math.hypot(first.x - last.x, first.y - last.y);
        return total;
    }

    private resamplePath(points: IPoint[], spacing: number): IPoint[] {
        if (!points || points.length < 2) {
            return points ? points.slice() : [];
        }

        const normalizedPoints = points.map((point) => ({ ...point }));
        const isClosed = this.arePointsEqual(
            normalizedPoints[0],
            normalizedPoints[normalizedPoints.length - 1],
        );
        if (!isClosed) {
            normalizedPoints.push({ ...normalizedPoints[0] });
        }

        const resampled: IPoint[] = [{ ...normalizedPoints[0] }];
        let previousPoint = normalizedPoints[0];
        let accumulated = 0;

        for (let i = 1; i < normalizedPoints.length; i++) {
            const currentPoint = normalizedPoints[i];
            let dx = currentPoint.x - previousPoint.x;
            let dy = currentPoint.y - previousPoint.y;
            let segmentLength = Math.hypot(dx, dy);

            if (segmentLength === 0) continue;

            while (accumulated + segmentLength >= spacing) {
                const ratio = (spacing - accumulated) / segmentLength;
                const newPoint: IPoint = {
                    x: previousPoint.x + dx * ratio,
                    y: previousPoint.y + dy * ratio,
                };
                resampled.push(newPoint);
                previousPoint = newPoint;
                dx = currentPoint.x - previousPoint.x;
                dy = currentPoint.y - previousPoint.y;
                segmentLength = Math.hypot(dx, dy);
                accumulated = 0;
            }

            accumulated += segmentLength;
            previousPoint = currentPoint;
        }

        if (
            resampled.length > 2 &&
            this.arePointsEqual(resampled[resampled.length - 1], resampled[0])
        ) {
            resampled.pop();
        }

        return resampled.length >= 3 ? resampled : points.slice();
    }

    private arePointsEqual(pointA: IPoint, pointB: IPoint): boolean {
        if (!pointA || !pointB) return false;
        return (
            Math.abs(pointA.x - pointB.x) < 0.001 &&
            Math.abs(pointA.y - pointB.y) < 0.001
        );
    }

    public cancelLabelCreation() {
        this.activePath = [];
        EditorActions.setViewPortActionsDisabledStatus(false);
        this.stopLassoDrawingMode();
    }

    private finishLabelCreation() {
        this.activePath = [];
        EditorActions.setViewPortActionsDisabledStatus(false);
        this.stopLassoDrawingMode();
    }

    public addLabelAndFinishCreation(data: EditorData) {
        if (
            GeneralSelector.getLineKeypointModeStatus() &&
            this.isCreationInProgress() &&
            this.activePath.length >= 1
        ) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    this.activePath,
                    data,
                );
            const radius =
                Math.min(...Object.values(data.realImageSize)) *
                this.scaleFactor;

            if (this.activePath.length === 1) {
                // Single click + finish: create one keypoint with the active label
                const generatedPolygon = this.generatePolygonFromKeypoint(
                    polygonOnImage[0],
                    radius,
                    8,
                );
                this.addPolygonLabel(generatedPolygon);
            } else {
                // Multiple clicks: assign sequentially from the start of the group
                const generatedPolygons = polygonOnImage.map((p) =>
                    this.generatePolygonFromKeypoint(p, radius, 8),
                );
                this.addPolygonLabelNKeypoints(generatedPolygons);
            }
            this.finishLabelCreation();
            return;
        }

        const pathForSaving: IPoint[] = this.prepareActivePathForSaving();
        if (this.isCreationInProgress() && pathForSaving.length > 2) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    pathForSaving,
                    data,
                );
            this.addPolygonLabel(polygonOnImage);
            this.finishLabelCreation();
        } else if (this.isCreationInProgress() && this.activePath.length == 1) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    this.activePath,
                    data,
                );
            const radius =
                Math.min(...Object.values(data.realImageSize)) *
                this.scaleFactor;

            // Draw kpt polygon
            const generatedPolygonFromKeypoint =
                this.generatePolygonFromKeypoint(polygonOnImage[0], radius, 8);
            this.addPolygonLabel(generatedPolygonFromKeypoint);
            this.finishLabelCreation();
        } else if (this.isCreationInProgress() && this.activePath.length == 2) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    this.activePath,
                    data,
                );
            const radius =
                Math.min(...Object.values(data.realImageSize)) *
                this.scaleFactor;

            // Draw 2 kpt polygons
            const generatedPolygons = [];
            for (let i = 0; i < polygonOnImage.length; i++) {
                const generatedPolygonFromKeypoint =
                    this.generatePolygonFromKeypoint(
                        polygonOnImage[i],
                        radius,
                        8,
                    );
                generatedPolygons.push(generatedPolygonFromKeypoint);
            }
            this.addPolygonLabel2Keypoints(generatedPolygons);

            this.finishLabelCreation();
        }
    }

    public addLabelAndFinishCreationEllipse(data: EditorData) {
        if (this.isCreationInProgress() && this.activePath.length == 3) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    this.activePath,
                    data,
                );
            const radius =
                Math.min(...Object.values(data.realImageSize)) *
                this.scaleFactor;

            // Draw 2 kpt polygons
            const generatedPolygons = [];
            for (let i = 0; i < polygonOnImage.length; i++) {
                const generatedPolygonFromKeypoint =
                    this.generatePolygonFromKeypoint(
                        polygonOnImage[i],
                        radius,
                        8,
                    );
                generatedPolygons.push(generatedPolygonFromKeypoint);
            }
            this.addPolygonLabel3Keypoints(generatedPolygons);

            // Draw the ellipse
            let startPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[0],
            );
            let endPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[1],
            );
            let constrainPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[2],
            );

            this.surfaceAnnotator.drawEllipse(
                this.canvas,
                startPoint,
                endPoint,
                constrainPoint,
            );
            this.finishLabelCreation();
        }
    }

    private addPolygonLabel(polygon: IPoint[]) {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelPolygon: LabelPolygon = LabelUtil.createLabelPolygon(
            activeLabelId,
            polygon,
        );
        imageData.labelPolygons.push(labelPolygon);
        store.dispatch(updateImageDataById(imageData.id, imageData));
        store.dispatch(updateFirstLabelCreatedFlag(true));
        store.dispatch(updateActiveLabelId(labelPolygon.id));
    }

    private addPolygonLabel2Keypoints(polygons) {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const imageData: ImageData = LabelsSelector.getActiveImageData();

        // Create a map of labelId to label name for easy lookup
        const labelIdToNameMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name; // label id: label name
            return map;
        }, {});
        const labelNameToIdMap = labelNames.reduce((map, label) => {
            map[label.name] = label.id; // label name: label id
            return map;
        }, {});
        const activeLabelName = labelIdToNameMap[activeLabelId];

        if (activeLabelName) {
            if (this.kptNameEndPattern.test(activeLabelName)) {
                const labelPolygon0: LabelPolygon =
                    LabelUtil.createLabelPolygon(activeLabelId, polygons[0]);

                let adjacentLabelName: string;
                if (activeLabelName === "p-b.k:Veins-1") {
                    adjacentLabelName = "p-b.k:Veins-3";
                } else {
                    adjacentLabelName = activeLabelName.replace(
                        this.kptNameEndPattern,
                        (match) => (parseInt(match, 10) + 1).toString(),
                    );
                }
                const adjacentLabelId = labelNameToIdMap[adjacentLabelName];
                if (adjacentLabelId) {
                    const labelPolygon1: LabelPolygon =
                        LabelUtil.createLabelPolygon(
                            adjacentLabelId,
                            polygons[1],
                        );
                    imageData.labelPolygons.push(labelPolygon0);
                    imageData.labelPolygons.push(labelPolygon1);
                }
                store.dispatch(updateImageDataById(imageData.id, imageData));
                store.dispatch(updateFirstLabelCreatedFlag(true));
                store.dispatch(updateActiveLabelId(labelPolygon0.id));
            }
        }
    }

    private findKeypointGroup(labelName: string): string[] | null {
        const allGroups = [
            asymKeypointNames_B,
            angleKeypointNames_B,
            surfaceKeypointNames_B,
            positionKeypointNames_B,
            veinsKeypointNames_B,
            avKeypointNames_B,
            tgaKeypointNames_D,
            asymKeypointNames_E,
            tgaKeypointNames_E,
            asymCSPKeypointNames_F,
            asymCIKeypointNames_F,
            angleSFKeypointNames_F,
            ratioSFKeypointNames_F,
            ratioAtrVMGKeypointNames_F,
            ratio4VKeypointNames_G,
        ];
        return allGroups.find((group) => group.includes(labelName)) || null;
    }

    private addPolygonLabelNKeypoints(polygons: IPoint[][]): void {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const imageData: ImageData = LabelsSelector.getActiveImageData();

        const labelIdToNameMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name;
            return map;
        }, {} as Record<string, string>);
        const labelNameToIdMap = labelNames.reduce((map, label) => {
            map[label.name] = label.id;
            return map;
        }, {} as Record<string, string>);

        const activeLabelName = labelIdToNameMap[activeLabelId];
        if (!activeLabelName) return;

        const group = this.findKeypointGroup(activeLabelName);
        if (!group) return;

        const sortedGroup = [...group].sort((a, b) => {
            const aMatch = a.match(this.kptNameEndPattern);
            const bMatch = b.match(this.kptNameEndPattern);
            const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
            const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
            return aNum - bNum;
        });

        const count = Math.min(polygons.length, sortedGroup.length);
        let firstLabelPolygon: LabelPolygon = null;

        for (let i = 0; i < count; i++) {
            const labelId = labelNameToIdMap[sortedGroup[i]];
            if (!labelId) continue;
            const labelPolygon: LabelPolygon = LabelUtil.createLabelPolygon(
                labelId,
                polygons[i],
            );
            if (!firstLabelPolygon) firstLabelPolygon = labelPolygon;
            imageData.labelPolygons.push(labelPolygon);
        }

        store.dispatch(updateImageDataById(imageData.id, imageData));
        store.dispatch(updateFirstLabelCreatedFlag(true));
        if (firstLabelPolygon) {
            store.dispatch(updateActiveLabelId(firstLabelPolygon.id));
        }
    }

    private addPolygonLabel3Keypoints(polygons) {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const imageData: ImageData = LabelsSelector.getActiveImageData();

        // Create a map of labelId to label name for easy lookup
        const labelIdToNameMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name; // label id: label name
            return map;
        }, {});
        const labelNameToIdMap = labelNames.reduce((map, label) => {
            map[label.name] = label.id; // label name: label id
            return map;
        }, {});
        const activeLabelName = labelIdToNameMap[activeLabelId];

        if (activeLabelName) {
            if (this.kptNameEndPattern.test(activeLabelName)) {
                const labelPolygon0: LabelPolygon =
                    LabelUtil.createLabelPolygon(activeLabelId, polygons[0]);

                const nextLabelName1 = activeLabelName.replace(
                    this.kptNameEndPattern,
                    (match) => (parseInt(match, 10) + 1).toString(),
                );
                const nextLabelId1 = labelNameToIdMap[nextLabelName1];
                const nextLabelName2 = activeLabelName.replace(
                    this.kptNameEndPattern,
                    (match) => (parseInt(match, 10) + 2).toString(),
                );
                const nextLabelId2 = labelNameToIdMap[nextLabelName2];
                if (nextLabelId1) {
                    const labelPolygon1: LabelPolygon =
                        LabelUtil.createLabelPolygon(nextLabelId1, polygons[1]);
                    const labelPolygon2: LabelPolygon =
                        LabelUtil.createLabelPolygon(nextLabelId2, polygons[2]);
                    imageData.labelPolygons.push(labelPolygon0);
                    imageData.labelPolygons.push(labelPolygon1);
                    imageData.labelPolygons.push(labelPolygon2);
                }
                store.dispatch(updateImageDataById(imageData.id, imageData));
                store.dispatch(updateFirstLabelCreatedFlag(true));
                store.dispatch(updateActiveLabelId(labelPolygon0.id));
            }
        }
    }

    private generatePolygonFromKeypoint(
        point: IPoint,
        radius: number,
        numberOfVertices: number,
    ) {
        const polygonVertices = [];
        const angleStep = (2 * Math.PI) / numberOfVertices;

        for (let i = 0; i < numberOfVertices; i++) {
            const angle = i * angleStep;
            const x = point.x + radius * Math.cos(angle);
            const y = point.y + radius * Math.sin(angle);
            polygonVertices.push({ x, y });
        }

        return polygonVertices;
    }

    private copyAndPasteAnnotations(data: EditorData) {
        const activeLabelId: string = LabelsSelector.getActiveLabelNameId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const activeLabelPolygon: LabelPolygon =
            LabelsSelector.getActivePolygonLabel();
        const labelPolygonsInImageData =
            this.getPolygonsOfActiveImage(imageData);

        if (this.copyPolygons)
            if (labelPolygonsInImageData.length > 0) {
                for (let i = 0; i < labelPolygonsInImageData.length; i++) {
                    const labelPolygon = labelPolygonsInImageData[i];
                    if (
                        !!labelPolygon.labelId &&
                        !this.checkPolygonAlreadyInMemory(labelPolygon)
                    )
                        this.copyAnnotationToMemory(labelPolygon);
                }
                GeneralSelector.deactivateCopyPolygons();
            } else GeneralSelector.deactivateCopyPolygons();

        if (this.pastePolygons) {
            this.pasteAnnotations();
            GeneralSelector.deactivatePastePolygons();
        }
    }

    private copyAnnotationToMemory(labelPolygon: LabelPolygon) {
        this.annotationsInMemory.push(labelPolygon);
    }

    private getPolygonsOfActiveImage(imageData: ImageData) {
        if (!!imageData && !!imageData.labelPolygons) {
            return imageData.labelPolygons;
        }
        return [];
    }

    private checkPolygonAlreadyInMemory(labelPolygon: LabelPolygon): boolean {
        const polygonId = labelPolygon.id;
        return this.annotationsInMemory.some(
            (polygon) => polygon.id === polygonId,
        );
    }

    private pasteAnnotations() {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        if (this.annotationsInMemory.length > 0) {
            for (let i = 0; i < this.annotationsInMemory.length; i++) {
                const currentLabelPolygon = this.annotationsInMemory[i];
                const currPolygon = currentLabelPolygon.vertices;
                const labelId = currentLabelPolygon.labelId;
                const labelPolygonWithNewId = LabelUtil.createLabelPolygon(
                    labelId,
                    currPolygon,
                );
                imageData.labelPolygons = this.removePolygonsInImageWithLabelId(
                    imageData,
                    labelId,
                );
                imageData.labelPolygons.push(labelPolygonWithNewId);
            }
            store.dispatch(updateImageDataById(imageData.id, imageData));
            this.annotationsInMemory = [];
        }
    }

    private removePolygonsInImageWithLabelId(
        imageData: ImageData,
        labelId: string,
    ) {
        return imageData.labelPolygons.filter(
            (polygon) => polygon.labelId != labelId,
        );
    }

    // =================================================================================================================
    // TRANSFER
    // =================================================================================================================

    private startExistingLabelResize(
        data: EditorData,
        labelId: string,
        anchorIndex: number,
    ) {
        store.dispatch(updateActiveLabelId(labelId));
        this.resizeAnchorIndex = anchorIndex;
        EditorActions.setViewPortActionsDisabledStatus(true);
    }

    private endExistingLabelResize(data: EditorData) {
        this.applyResizeToPolygonLabel(data);
        this.resizeAnchorIndex = null;
        EditorActions.setViewPortActionsDisabledStatus(false);
    }

    private applyResizeToPolygonLabel(data: EditorData) {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const activeLabel: LabelPolygon =
            LabelsSelector.getActivePolygonLabel();
        imageData.labelPolygons = imageData.labelPolygons.map(
            (polygon: LabelPolygon) => {
                if (polygon.id !== activeLabel.id) {
                    return polygon;
                } else {
                    return {
                        ...polygon,
                        vertices: polygon.vertices.map(
                            (value: IPoint, index: number) => {
                                if (index !== this.resizeAnchorIndex) {
                                    return value;
                                } else {
                                    const snappedMousePosition: IPoint =
                                        RectUtil.snapPointToRect(
                                            data.mousePositionOnViewPortContent,
                                            data.viewPortContentImageRect,
                                        );
                                    return RenderEngineUtil.transferPointFromViewPortContentToImage(
                                        snappedMousePosition,
                                        data,
                                    );
                                }
                            },
                        ),
                    };
                }
            },
        );
        store.dispatch(updateImageDataById(imageData.id, imageData));
        store.dispatch(updateActiveLabelId(activeLabel.id));
    }

    private discardSuggestedPoint(): void {
        this.suggestedAnchorIndexInPolygon = null;
        this.suggestedAnchorPositionOnCanvas = null;
    }

    // =================================================================================================================
    // UPDATE
    // =================================================================================================================

    private addSuggestedAnchorToPolygonLabel(data: EditorData) {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const activeLabel: LabelPolygon =
            LabelsSelector.getActivePolygonLabel();
        const newAnchorPositionOnImage: IPoint =
            RenderEngineUtil.transferPointFromViewPortContentToImage(
                this.suggestedAnchorPositionOnCanvas,
                data,
            );
        const insert = (arr, index, newItem) => [
            ...arr.slice(0, index),
            newItem,
            ...arr.slice(index),
        ];

        const newImageData: ImageData = {
            ...imageData,
            labelPolygons: imageData.labelPolygons.map(
                (polygon: LabelPolygon) => {
                    if (polygon.id !== activeLabel.id) {
                        return polygon;
                    } else {
                        return {
                            ...polygon,
                            vertices: insert(
                                polygon.vertices,
                                this.suggestedAnchorIndexInPolygon,
                                newAnchorPositionOnImage,
                            ),
                        };
                    }
                },
            ),
        };

        store.dispatch(updateImageDataById(newImageData.id, newImageData));
        this.startExistingLabelResize(
            data,
            activeLabel.id,
            this.suggestedAnchorIndexInPolygon,
        );
        this.discardSuggestedPoint();
    }

    // =================================================================================================================
    // VALIDATORS
    // =================================================================================================================

    public isInProgress(): boolean {
        return this.isCreationInProgress() || this.isResizeInProgress();
    }

    private isCreationInProgress(): boolean {
        return this.activePath !== null && this.activePath.length !== 0;
    }

    private isResizeInProgress(): boolean {
        return this.resizeAnchorIndex !== null;
    }

    private isMouseOverAnchor(mouse: IPoint, anchor: IPoint): boolean {
        if (!mouse || !anchor) return null;
        return RectUtil.isPointInside(
            RectUtil.getRectWithCenterAndSize(
                anchor,
                RenderEngineSettings.anchorSize,
            ),
            mouse,
        );
    }

    // =================================================================================================================
    // GETTERS
    // =================================================================================================================

    private getPolygonUnderMouse(data: EditorData): LabelPolygon | null {
        const mouseOnCanvas = data.mousePositionOnViewPortContent;
        if (!mouseOnCanvas) return null;

        const labelPolygons: LabelPolygon[] =
            LabelsSelector.getActiveImageData().labelPolygons.filter(
                (labelPolygon: LabelPolygon) => labelPolygon.isVisible,
            );
        const radius = RenderEngineSettings.anchorHoverSize.width / 2;

        for (const labelPolygon of labelPolygons) {
            const verticesOnCanvas =
                RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                    labelPolygon.vertices,
                    data,
                );
            if (
                RenderEngineUtil.isMouseOverPolygon(
                    mouseOnCanvas,
                    verticesOnCanvas,
                    radius,
                )
            ) {
                return labelPolygon;
            }
        }
        return null;
    }

    private getAnchorUnderMouse(data: EditorData): IPoint | null {
        const mouseOnCanvas = data.mousePositionOnViewPortContent;
        if (!mouseOnCanvas) return null;

        const labelPolygons: LabelPolygon[] =
            LabelsSelector.getActiveImageData().labelPolygons.filter(
                (labelPolygon: LabelPolygon) => labelPolygon.isVisible,
            );
        const radius = RenderEngineSettings.anchorHoverSize.width / 2;

        for (const labelPolygon of labelPolygons) {
            const verticesOnCanvas =
                RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                    labelPolygon.vertices,
                    data,
                );
            for (const vertexOnCanvas of verticesOnCanvas) {
                if (
                    RenderEngineUtil.isMouseOverAnchor(
                        mouseOnCanvas,
                        vertexOnCanvas,
                        radius,
                    )
                )
                    return vertexOnCanvas;
            }
        }
        return null;
    }
}

export class KeypointSurfaceAnnotation {
    /*
        Draw circle and ellipse for surface measurements, 
        --> each clicked point is a polygon keypoint
        Click 1st point: create the point on canvas then draw a dynamic circle whose diameter
            is the clicked point and the tip of the mouse
        Click 2nd point: create the 2nd point on the canvas 
            --> create 2 keypoint polygons
            --> draw the final circle whose diameter is formed by 2 points on the canvas 
            --> save and erase the circle to create a moving ellipse 
                whose major axis is point1-point2, and passing through the tip of the mouse
                (if cannot find the satisfying ellipse, stop drawing)
        Click 3rd point: create the 3rd keypoint polygon 
            --> create a fixed ellipse if ellipse exists else keep the circle
    */
    public activeAnchorPoints: IPoint[] = [];
    // public activeConstrainPoint: IPoint = {};

    public processAnnotation(
        canvas: HTMLCanvasElement,
        data: EditorData,
        points: IPoint[],
    ) {
        if (points.length > 0) {
            this.activeAnchorPoints = points;
        } else this.reset();

        if (
            this.activeAnchorPoints.length > 0 &&
            this.activeAnchorPoints.length <= 3
        ) {
            let startPoint = this.activeAnchorPoints[0];
            let endPoint =
                this.activeAnchorPoints.length >= 2
                    ? this.activeAnchorPoints[1]
                    : data.mousePositionOnViewPortContent;
            let mousePosition = RenderEngineUtil.setPointBetweenPixels(
                data.mousePositionOnViewPortContent,
            );
            if (
                this.activeAnchorPoints.length == 1 ||
                (this.activeAnchorPoints.length == 2 &&
                    this.arePointsEqual(endPoint, mousePosition))
            ) {
                this.drawCircle(canvas, startPoint, endPoint);
            } else if (
                this.activeAnchorPoints.length == 2 &&
                !this.arePointsEqual(endPoint, mousePosition)
            ) {
                this.drawEllipse(
                    canvas,
                    startPoint,
                    endPoint,
                    data.mousePositionOnViewPortContent,
                );
            } else if (this.activeAnchorPoints.length == 3) {
                this.drawEllipse(
                    canvas,
                    startPoint,
                    endPoint,
                    this.activeAnchorPoints[2],
                );
            }
        } else {
            this.reset();
        }
    }

    public drawCircle(
        canvas: HTMLCanvasElement,
        startPoint: IPoint,
        endPoint: IPoint,
    ) {
        // Calculate circle properties
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const diameter = Math.sqrt(dx * dx + dy * dy);
        const radius = diameter / 2;
        const center: IPoint = {
            x: startPoint.x + dx / 2,
            y: startPoint.y + dy / 2,
        };

        // Draw circle
        DrawUtil.drawDashCircle(canvas, center, radius, 0, 360, 1);
    }

    public static computeEllipse(
        startPoint: IPoint,
        endPoint: IPoint,
        constrainPoint: IPoint,
    ) {
        // Calculate circle properties
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const diameter = Math.sqrt(dx * dx + dy * dy);
        const majorAxis = diameter / 2;
        const center: IPoint = {
            x: startPoint.x + dx / 2,
            y: startPoint.y + dy / 2,
        };
        const rotateAngle = Math.atan2(dy, dx);
        const rotateCosine = Math.cos(-rotateAngle);
        const rotateSine = Math.sin(-rotateAngle);
        const constrainPointToCenter: IPoint = {
            x: constrainPoint.x - center.x,
            y: constrainPoint.y - center.y,
        };
        const mappedConstrainPoint: IPoint = {
            x:
                rotateCosine * constrainPointToCenter.x -
                rotateSine * constrainPointToCenter.y,
            y:
                rotateSine * constrainPointToCenter.x +
                rotateCosine * constrainPointToCenter.y,
        };

        // constrainPoint is on the ellipse with formula (x/a)^2 + (y/b)^2 = 1 --> compute b
        const minorAxis =
            Math.abs(mappedConstrainPoint.y) /
            Math.sqrt(1 - (mappedConstrainPoint.x / majorAxis) ** 2);
        const ellipseProperties = {
            center: center,
            majorAxis: majorAxis,
            minorAxis: minorAxis,
            rotateAngle: rotateAngle,
            mappedConstrainPoint: mappedConstrainPoint,
        };
        return ellipseProperties;
    }

    public drawEllipse(
        canvas: HTMLCanvasElement,
        startPoint: IPoint,
        endPoint: IPoint,
        constrainPoint: IPoint,
        color: string = "#ffffff",
    ) {
        const ellipseProperties = KeypointSurfaceAnnotation.computeEllipse(
            startPoint,
            endPoint,
            constrainPoint,
        );
        // Draw ellipse
        DrawUtil.drawDashEllipse(
            canvas,
            ellipseProperties.center,
            ellipseProperties.majorAxis,
            ellipseProperties.minorAxis,
            ellipseProperties.rotateAngle,
            0,
            360,
            1,
            color,
        );
    }

    private arePointsEqual(point1: IPoint, point2: IPoint) {
        return point1.x === point2.x && point1.y === point2.y;
    }
    private reset() {
        this.activeAnchorPoints = [];
    }
}

export class KeypointUtils {
    public getKeypointsFromPolygons() {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();

        // Create a map of labelId to label name for easy lookup
        const labelMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name; // label id: label name
            return map;
        }, {});

        // Map labelId in annotations to the corresponding name and filters only keypoints

        const allKeypointAnnotations = imageData.labelPolygons
            .filter((annotation) => annotation.isVisible)
            .map((annotation) => ({
                ...annotation,
                labelName: annotation.labelId
                    ? labelMap[annotation.labelId] || null
                    : null, // Find the name based on labelId
            }))
            .filter(
                (annotation) =>
                    annotation.labelName &&
                    allKeypointNames.includes(annotation.labelName),
            ); // Filter by specific names

        // Compute centroids
        const allKeypointCenters = allKeypointAnnotations.map((annotation) => ({
            id: annotation.id,
            labelName: annotation.labelName,
            centroid: this.computeCentroid(annotation),
        }));

        return allKeypointCenters;
    }

    public buildMeasurements() {
        const allKeypointCenters = this.getKeypointsFromPolygons();
        const asymRatio_B = this.computeDistanceRatio(
            allKeypointCenters,
            asymKeypointNames_B,
        );
        const angle_B = this.computeAngle(
            allKeypointCenters,
            angleKeypointNames_B,
        );
        const areaRatio_B = this.computeSurfaceRatio(
            allKeypointCenters,
            surfaceKeypointNames_B,
        );
        const positionRatio_B = this.computePositionRatio(
            allKeypointCenters,
            positionKeypointNames_B,
        );
        const veinsRatio_B = this.computeDistanceRatio(
            allKeypointCenters,
            veinsKeypointNames_B,
        );
        const avRatio_B = this.computeDistanceRatio(
            allKeypointCenters,
            avKeypointNames_B,
        );
        const tgaRatio_D = this.computeDistanceRatio(
            allKeypointCenters,
            tgaKeypointNames_D,
        );
        const asymRatio_E = this.computeDistanceRatio(
            allKeypointCenters,
            asymKeypointNames_E,
        );
        const tgaRatio_E = this.computeDistanceRatioWithProjection(
            allKeypointCenters,
            tgaKeypointNames_E,
        );
        const asymRatioCSP_F = this.computeDistanceRatio(
            allKeypointCenters,
            asymCSPKeypointNames_F,
        );
        const asymRatioCI_F = this.computeDistanceRatio(
            allKeypointCenters,
            asymCIKeypointNames_F,
        );
        const angleSF_F = this.computeAngle(
            allKeypointCenters,
            angleSFKeypointNames_F,
        );
        const ratioSF_F = this.computeDistanceRatio(
            allKeypointCenters,
            ratioSFKeypointNames_F,
        );
        const ratioAtrVMG_F = this.computeDistanceRatio(
            allKeypointCenters,
            ratioAtrVMGKeypointNames_F,
        );
        const ratio4V_G = this.computeDistanceRatio(
            allKeypointCenters,
            ratio4VKeypointNames_G,
        );

        return [
            asymRatio_B,
            angle_B,
            areaRatio_B,
            positionRatio_B,
            veinsRatio_B,
            avRatio_B,
            tgaRatio_D,
            asymRatio_E,
            tgaRatio_E,
            asymRatioCSP_F,
            asymRatioCI_F,
            angleSF_F,
            ratioSF_F,
            ratioAtrVMG_F,
            ratio4V_G,
        ];
    }

    public computeCentroid(polygon: LabelPolygon): IPoint {
        const { vertices } = polygon;

        if (vertices.length === 0) {
            throw new Error("No vertices in the polygon");
        }

        // Summing up the x and y coordinates of the vertices
        const sum = vertices.reduce(
            (acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            },
            { x: 0, y: 0 },
        );

        // Calculate the average to find the centroid
        const centroid = {
            x: sum.x / vertices.length,
            y: sum.y / vertices.length,
        };

        return centroid;
    }

    private computeDistance(point1: IPoint, point2: IPoint): number {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Function to compute the ratio of distances between kp1, kp2, and kp3 polygons
    private computeDistanceRatio(
        keypointCenters: {
            id: string;
            labelName: string;
            centroid: IPoint;
        }[],
        keypointNames: string[],
    ): number | null {
        const keypoints = [];

        for (let i = 0; i < keypointNames.length; i++) {
            const selectedCenter = keypointCenters.find(
                (polygon) => polygon.labelName === keypointNames[i],
            );
            keypoints.push(selectedCenter);
        }

        // Ensure all selected keypoints are present
        if (keypoints.includes(undefined)) {
            // console.error('There are not enough keypoints')
            return null;
        }

        // Compute distances
        if (keypoints.length === 3) {
            const distance_kp2_kp3 = this.computeDistance(
                keypoints[1].centroid,
                keypoints[2].centroid,
            );
            const distance_kp1_kp2 = this.computeDistance(
                keypoints[0].centroid,
                keypoints[1].centroid,
            );
            const ratio = distance_kp2_kp3 / (distance_kp1_kp2 + 1e-6);
            // console.log('ratio', ratio)
            return ratio;
        } else if (keypoints.length === 4) {
            const distance_kp3_kp4 = this.computeDistance(
                keypoints[2].centroid,
                keypoints[3].centroid,
            );
            const distance_kp1_kp2 = this.computeDistance(
                keypoints[0].centroid,
                keypoints[1].centroid,
            );
            const ratio = distance_kp3_kp4 / (distance_kp1_kp2 + 1e-6);
            // console.log('ratio', ratio)
            return ratio;
        } else {
            // console.error('There are an unexpected number of keypoints (${keypoints.length})')
            return null;
        }
    }

    private computeVector(point1: IPoint, point2: IPoint): IPoint {
        const vector: IPoint = {
            x: point1.x - point2.x,
            y: point1.y - point2.y,
        };
        return vector;
    }

    // Function to compute the angle between the vectors formed by kp1, kp2, and kp3, kp4
    private computeAngle(
        keypointCenters: {
            id: string;
            labelName: string;
            centroid: IPoint;
        }[],
        keypointNames: string[],
    ): number | null {
        const keypoints = [];

        for (let i = 0; i < keypointNames.length; i++) {
            const selectedCenter = keypointCenters.find(
                (polygon) => polygon.labelName === keypointNames[i],
            );
            keypoints.push(selectedCenter);
        }

        // Ensure all selected keypoints are present
        if (
            (keypointNames.length === 5 &&
                keypoints.slice(0, 4).includes(undefined)) ||
            (keypointNames.length === 3 &&
                keypoints.slice(0, 3).includes(undefined))
        ) {
            // console.error('There are not enough keypoints')
            return null;
        }
        console.log(keypoints);
        console.log(keypointNames);

        if (keypointNames.length === 3) {
            // insert to keypoints at 3rd position with a copy of keypoints[1]
            keypoints.splice(2, 0, keypoints[1]);
        }

        // Angle values
        const vect1 = this.computeVector(
            keypoints[0].centroid,
            keypoints[1].centroid,
        );
        const vect2 = this.computeVector(
            keypoints[2].centroid,
            keypoints[3].centroid,
        );
        const angle =
            (Math.atan2(
                vect1.x * vect2.y - vect1.y * vect2.x,
                vect1.x * vect2.x + vect1.y * vect2.y,
            ) *
                180) /
            Math.PI;

        // Sign
        // Check if the 5th keypoint is defined
        if (keypoints[4] !== undefined) {
            const vect3 = this.computeVector(
                keypoints[4].centroid,
                keypoints[3].centroid,
            );
            const sign = Math.sign(vect2.x * vect3.y - vect2.y * vect3.x);
            return sign * angle;
        }

        return Math.abs(angle);
    }

    // private computeAngle3Points(
    //     keypointCenters: {
    //         id: string;
    //         labelName: string;
    //         centroid: IPoint;
    //     }[],
    //     keypointNames: string[]
    // ): number | null {
    //     const keypoints = [];

    // }

    private findLineEquationFrom2Points(
        linePoint1: IPoint,
        linePoint2: IPoint,
    ) {
        // Solve for line parameters
        // [x1 y1] [a] = [-1]
        // [x2 y2] [b]   [-1]

        const a = linePoint2.y - linePoint1.y;
        const b = linePoint1.x - linePoint2.x;
        const c = linePoint2.x * linePoint1.y - linePoint1.x * linePoint2.y;

        return [a, b, c]; // Line equation: ax + by + c = 0
    }

    private findLineEquationFromNormalVectorAnd1Point(
        normalVector: IPoint,
        point: IPoint,
    ) {
        const a = normalVector.x;
        const b = normalVector.y;
        const c = -a * point.x - b * point.y;

        return [a, b, c]; // Line equation: ax + by + c = 0
    }

    private projectPointOntoLine(lineParams: number[], point: IPoint) {
        const [a1, b1, c1] = lineParams;
        const a2 = b1;
        const b2 = -a1;
        const c2 = -a2 * point.x - b2 * point.y;
        const x = -(c1 * b2 - c2 * b1) / (a1 * b2 - a2 * b1);
        const projectedPoint: IPoint = {
            x: x,
            y: (-c1 - a1 * x) / b1,
        };
        return projectedPoint;
    }

    // Function to compute the ratio of distances between kp1, kp2, and kp3 polygons
    private computeDistanceRatioWithProjection(
        keypointCenters: {
            id: string;
            labelName: string;
            centroid: IPoint;
        }[],
        keypointNames: string[],
    ): number | null {
        const keypoints = [];

        for (let i = 0; i < keypointNames.length; i++) {
            const selectedCenter = keypointCenters.find(
                (polygon) => polygon.labelName === keypointNames[i],
            );
            keypoints.push(selectedCenter);
        }

        // Ensure all selected keypoints are present
        if (keypoints.includes(undefined)) {
            // console.error('There are not enough keypoints')
            return null;
        }

        // Compute distances
        if (keypoints.length === 3) {
            const directionVectorOfLine01 = this.computeVector(
                keypoints[0].centroid,
                keypoints[1].centroid,
            );
            const normalVectorOfLine01: IPoint = {
                x: directionVectorOfLine01.y,
                y: -directionVectorOfLine01.x,
            };
            const lineParamsOfLine2 =
                this.findLineEquationFromNormalVectorAnd1Point(
                    normalVectorOfLine01,
                    keypoints[2].centroid,
                );
            const projectedPoint = this.projectPointOntoLine(
                lineParamsOfLine2,
                keypoints[1].centroid,
            );
            const distance_kp3_projectPoint = this.computeDistance(
                projectedPoint,
                keypoints[2].centroid,
            );
            const distance_kp1_kp2 = this.computeDistance(
                keypoints[0].centroid,
                keypoints[1].centroid,
            );
            const ratio = distance_kp3_projectPoint / (distance_kp1_kp2 + 1e-6);
            // console.log('ratio', ratio)
            return ratio;
        } else {
            // console.error('There are an unexpected number of keypoints (${keypoints.length})')
            return null;
        }
    }

    private computeEllipseArea(majorAxis: number, minorAxis: number) {
        return Math.PI * majorAxis * minorAxis;
    }
    private computeEllipseCircumference(majorAxis: number, minorAxis: number) {
        const h = (majorAxis - minorAxis) ** 2 / (majorAxis + minorAxis) ** 2;
        const approxCircumference =
            Math.PI *
            (majorAxis + minorAxis) *
            (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
        return approxCircumference;
    }

    // Function to compute the surface ratio between the ellipse formed by kp1, kp2, kp3 and kp4, kp5, kp6
    private computeSurfaceRatio(
        keypointCenters: {
            id: string;
            labelName: string;
            centroid: IPoint;
        }[],
        keypointNames: string[],
    ): number | null {
        const keypoints = [];

        for (let i = 0; i < keypointNames.length; i++) {
            const selectedCenter = keypointCenters.find(
                (polygon) => polygon.labelName === keypointNames[i],
            );
            keypoints.push(selectedCenter);
        }

        // Ensure all selected keypoints are present
        if (keypoints.includes(undefined)) {
            // console.error('There are not enough keypoints')
            return null;
        }

        // Compute ellipse properties
        if (keypoints.length === 6) {
            const propertiesEllipse1 = KeypointSurfaceAnnotation.computeEllipse(
                keypoints[3].centroid,
                keypoints[4].centroid,
                keypoints[5].centroid,
            );
            const propertiesEllipse2 = KeypointSurfaceAnnotation.computeEllipse(
                keypoints[0].centroid,
                keypoints[1].centroid,
                keypoints[2].centroid,
            );
            // const circumferenceEllipse1 = this.computeEllipseCircumference(propertiesEllipse1.majorAxis, propertiesEllipse1.minorAxis);
            // const circumferenceEllipse2 = this.computeEllipseCircumference(propertiesEllipse2.majorAxis, propertiesEllipse2.minorAxis);
            const areaEllipse1 = this.computeEllipseArea(
                propertiesEllipse1.majorAxis,
                propertiesEllipse1.minorAxis,
            );
            const areaEllipse2 = this.computeEllipseArea(
                propertiesEllipse2.majorAxis,
                propertiesEllipse2.minorAxis,
            );
            const areaRatio = areaEllipse1 / (areaEllipse2 + 1e-6);
            return areaRatio;
        } else {
            return null;
        }
    }

    private findEllipseKeypoints(
        ellipseKp1: IPoint,
        ellipseKp2: IPoint,
        ellipseKp3: IPoint,
        nbPoints: number = 4,
    ) {
        if (nbPoints < 4) {
            throw new Error("Number of points must be at least 4");
        }
        const propertiesEllipse = KeypointSurfaceAnnotation.computeEllipse(
            ellipseKp1,
            ellipseKp2,
            ellipseKp3,
        );

        const center = propertiesEllipse.center;
        const majorAxis = propertiesEllipse.majorAxis;
        const minorAxis = propertiesEllipse.minorAxis;
        const angleRad = propertiesEllipse.rotateAngle;
        const mappedConstrainPoint = propertiesEllipse.mappedConstrainPoint;

        let kp3Rotated, kp4Rotated;
        if (mappedConstrainPoint.y > 0) {
            kp3Rotated = [0.0, minorAxis];
            kp4Rotated = [0.0, -minorAxis];
        } else {
            kp3Rotated = [0.0, -minorAxis];
            kp4Rotated = [0.0, minorAxis];
        }

        // Create inverted rotation matrix
        const rotMatInverted = [
            [Math.cos(angleRad), -Math.sin(angleRad)],
            [Math.sin(angleRad), Math.cos(angleRad)],
        ];

        // Parametric equation function
        const parametricEquation = (phi: number) => {
            const cosVal = Math.cos(phi);
            const sinVal = Math.sin(phi);

            return [
                center.x +
                    rotMatInverted[0][0] * majorAxis * cosVal +
                    rotMatInverted[0][1] * minorAxis * sinVal,
                center.y +
                    rotMatInverted[1][0] * majorAxis * cosVal +
                    rotMatInverted[1][1] * minorAxis * sinVal,
            ];
        };

        // Calculate key points
        const kp1 = [ellipseKp1.x, ellipseKp1.y];
        const kp2 = [ellipseKp2.x, ellipseKp2.y];
        const kp3 = [
            center.x + rotMatInverted[0][1] * kp3Rotated[1],
            center.y + rotMatInverted[1][1] * kp3Rotated[1],
        ];
        const kp4 = [
            center.x + rotMatInverted[0][1] * kp4Rotated[1],
            center.y + rotMatInverted[1][1] * kp4Rotated[1],
        ];

        // Create ellipse points array
        const ellipsePoints = [kp1, kp2, kp3, kp4];

        // Add additional points
        const step = (2 * Math.PI) / nbPoints;
        for (let i = 0; i < nbPoints; i++) {
            const ang = i * step;
            if (![0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].includes(ang)) {
                ellipsePoints.push(parametricEquation(ang));
            }
        }

        return [ellipsePoints, majorAxis, minorAxis];
    }

    private orderPointsCounterclockwise(points) {
        // Calculate centroid
        let cx = 0,
            cy = 0;
        for (const point of points) {
            cx += point[0];
            cy += point[1];
        }
        cx /= points.length;
        cy /= points.length;

        // Calculate angles and create pairs
        const pointsWithAngles = points.map((point) => {
            const angle = Math.atan2(point[1] - cy, point[0] - cx);
            return { point, angle };
        });
        // Sort by angle
        pointsWithAngles.sort((a, b) => a.angle - b.angle);

        // Extract sorted points
        return pointsWithAngles.map((item) => item.point);
    }

    private pointsToLineSign(linePoint1, linePoint2, points) {
        // Convert line points to arrays
        const p1 = [linePoint1.x, linePoint1.y];
        const p2 = [linePoint2.x, linePoint2.y];

        // Calculate the direction vector of the line
        const vectLine = [p2[0] - p1[0], p2[1] - p1[1]];

        // Calculate vectors from p1 to each point
        const vectsPointsP1 = points.map((point) => [
            point[0] - p1[0],
            point[1] - p1[1],
        ]);

        // Calculate cross product
        const crossProd = vectsPointsP1.map(
            (vect) => vectLine[0] * vect[1] - vectLine[1] * vect[0],
        );

        // Return the sign of the cross product
        return crossProd.map((val) => Math.sign(val));
    }

    private computePolygonAreaShoelace(points) {
        if (points.length < 3) {
            return 0;
        }

        let area = 0;
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }

        return Math.abs(area) / 2;
    }

    private calculateEllipseRatioByPolygon(
        ellipseP1,
        ellipseP2,
        ellipseP3,
        linePoint1,
        linePoint2,
        nbApproxPointsEllipse,
    ) {
        // Find ellipse keypoints
        const [ellipsePoints, majorAxis, minorAxis] = this.findEllipseKeypoints(
            ellipseP1,
            ellipseP2,
            ellipseP3,
            nbApproxPointsEllipse,
        );

        const kp1 = ellipsePoints[0];
        const kp2 = ellipsePoints[1];
        const kp3 = ellipsePoints[2];

        // Calculate vectors
        const vectKp2Kp1 = [kp2[0] - kp1[0], kp2[1] - kp1[1]];
        const vectKp3Kp1 = [kp3[0] - kp1[0], kp3[1] - kp1[1]];

        // Cross product sign
        const sign = Math.sign(
            vectKp2Kp1[0] * vectKp3Kp1[1] - vectKp2Kp1[1] * vectKp3Kp1[0],
        );

        // Order points counterclockwise
        const orderedPoints = this.orderPointsCounterclockwise(ellipsePoints);

        // Calculate signs for each point
        const signs = this.pointsToLineSign(
            linePoint1,
            linePoint2,
            orderedPoints,
        ).map((s) => !!(sign * s > 0));

        // Filter points based on sign
        const ellipsePointsForRatio = orderedPoints.filter(
            (_, i) => signs[i] === true,
        );

        // Calculate ratio
        const ratio =
            this.computePolygonAreaShoelace(ellipsePointsForRatio) /
            (Math.PI * (majorAxis as number) * (minorAxis as number) + 1e-6);
        return ratio;
    }

    // Function to compute the surface ratio between the ellipse formed by kp1, kp2, kp3 and kp4, kp5, kp6
    public computePositionRatio(
        keypointCenters: {
            id: string;
            labelName: string;
            centroid: IPoint;
        }[],
        keypointNames: string[],
    ): number | null {
        //
        const keypoints = [];

        for (let i = 0; i < keypointNames.length; i++) {
            const selectedCenter = keypointCenters.find(
                (polygon) => polygon.labelName === keypointNames[i],
            );
            keypoints.push(selectedCenter);
        }

        // Ensure all selected keypoints are present
        if (keypoints.includes(undefined)) {
            // console.error('There are not enough keypoints')
            return null;
        }

        // Compute ellipse properties
        if (keypoints.length === 5) {
            const positionRatio = this.calculateEllipseRatioByPolygon(
                keypoints[2].centroid,
                keypoints[3].centroid,
                keypoints[4].centroid,
                keypoints[0].centroid,
                keypoints[1].centroid,
                1000,
            );
            return positionRatio;
        } else {
            return null;
        }
    }
}
