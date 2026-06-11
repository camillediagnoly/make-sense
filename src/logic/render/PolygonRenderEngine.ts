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
import {
    getMeasurementConnections,
    getMeasurementFunctionConfig,
    getMinimumKeypointCount,
    inferMeasurementDefinitions,
    MeasurementConnection,
    MeasurementDefinition,
    MeasurementFunctionId,
    parseKeypointName,
} from "../../data/measurements/MeasurementFunctionData";

type RenderableKeypointData = {
    id: string;
    labelName: string;
    centroid: IPoint;
};

type RenderableMeasurementCenterMap = Map<
    string,
    Map<number, Map<string, RenderableKeypointData>>
>;

export type KeypointCenter = RenderableKeypointData & {
    measurementName: string;
    keypointIndex: number;
    suffix: string;
};

export type MeasurementResult = {
    measurementName: string;
    displayName: string;
    functionId: MeasurementFunctionId | null;
    functionName: string;
    value: number | null;
    unit: "degree" | null;
};

const LASSO_MIN_SAMPLE_DISTANCE = 5;
const DEFAULT_LASSO_TARGET_VERTEX_COUNT = 20;

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

    private getMeasurementDefinitions(): MeasurementDefinition[] {
        return inferMeasurementDefinitions(
            LabelsSelector.getLabelNames(),
            GeneralSelector.getMeasurementFunctionByName()
        );
    }

    private buildRenderableKeypointCenterMap(): RenderableMeasurementCenterMap {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const labelMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name;
            return map;
        }, {} as Record<string, string>);
        const centerMap: RenderableMeasurementCenterMap = new Map();

        if (!imageData) {
            return centerMap;
        }

        imageData.labelPolygons
            .filter((annotation) => annotation.isVisible)
            .forEach((annotation) => {
                const labelName = annotation.labelId
                    ? labelMap[annotation.labelId] || null
                    : null;
                if (!labelName) {
                    return;
                }

                const parsedKeypointName = parseKeypointName(labelName);
                if (!parsedKeypointName) {
                    return;
                }

                const perMeasurementMap =
                    centerMap.get(parsedKeypointName.measurementName) ||
                    new Map<number, Map<string, RenderableKeypointData>>();
                const perIndexMap =
                    perMeasurementMap.get(parsedKeypointName.keypointIndex) ||
                    new Map<string, RenderableKeypointData>();

                perIndexMap.set(parsedKeypointName.suffix, {
                    id: annotation.id,
                    labelName,
                    centroid: this.keypointUtils.computeCentroid(annotation),
                });
                perMeasurementMap.set(
                    parsedKeypointName.keypointIndex,
                    perIndexMap
                );
                centerMap.set(
                    parsedKeypointName.measurementName,
                    perMeasurementMap
                );
            });

        return centerMap;
    }

    private drawLineBetweenKeypointCenters(
        startCenter: IPoint,
        endCenter: IPoint,
        lineColor: string,
        data: EditorData
    ): void {
        const lineToDraw: ILine = {
            start: startCenter,
            end: endCenter,
        };
        const lineOnCanvas =
            RenderEngineUtil.transferLineFromImageToViewPortContent(
                lineToDraw,
                data
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
            RenderEngineSettings.LINE_THICKNESS
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

    private getRenderableKeypointsByPosition(
        measurementDefinition: MeasurementDefinition,
        keypointCenterMap: RenderableMeasurementCenterMap,
        position: number
    ): Map<string, RenderableKeypointData> | null {
        const keypointIndex = measurementDefinition.keypointIndexes[position];
        if (keypointIndex === undefined) {
            return null;
        }

        return (
            keypointCenterMap
                .get(measurementDefinition.measurementName)
                ?.get(keypointIndex) || null
        );
    }

    private drawMeasurementLineConnection(
        measurementDefinition: MeasurementDefinition,
        connection: Extract<MeasurementConnection, { type: "line" }>,
        keypointCenterMap: RenderableMeasurementCenterMap,
        data: EditorData
    ): void {
        const startBySuffix = this.getRenderableKeypointsByPosition(
            measurementDefinition,
            keypointCenterMap,
            connection.fromPosition
        );
        const endBySuffix = this.getRenderableKeypointsByPosition(
            measurementDefinition,
            keypointCenterMap,
            connection.toPosition
        );

        if (!startBySuffix || !endBySuffix) {
            return;
        }

        startBySuffix.forEach((startPointData, suffix) => {
            const endPointData = endBySuffix.get(suffix);
            if (!endPointData) {
                return;
            }

            this.drawLineBetweenKeypointCenters(
                startPointData.centroid,
                endPointData.centroid,
                this.resolveLineColorBySuffix(suffix),
                data
            );
        });
    }

    private drawMeasurementEllipseConnection(
        measurementDefinition: MeasurementDefinition,
        connection: Extract<MeasurementConnection, { type: "ellipse" }>,
        keypointCenterMap: RenderableMeasurementCenterMap,
        data: EditorData
    ): void {
        const firstBySuffix = this.getRenderableKeypointsByPosition(
            measurementDefinition,
            keypointCenterMap,
            connection.firstPosition
        );
        const secondBySuffix = this.getRenderableKeypointsByPosition(
            measurementDefinition,
            keypointCenterMap,
            connection.secondPosition
        );
        const thirdBySuffix = this.getRenderableKeypointsByPosition(
            measurementDefinition,
            keypointCenterMap,
            connection.thirdPosition
        );

        if (!firstBySuffix || !secondBySuffix || !thirdBySuffix) {
            return;
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
                    data
                );
            const startPoint = RenderEngineUtil.setPointBetweenPixels(
                pointsOnCanvas[0]
            );
            const endPoint = RenderEngineUtil.setPointBetweenPixels(
                pointsOnCanvas[1]
            );
            const constrainPoint = RenderEngineUtil.setPointBetweenPixels(
                pointsOnCanvas[2]
            );

            this.surfaceAnnotator.drawEllipse(
                this.canvas,
                startPoint,
                endPoint,
                constrainPoint,
                this.resolveLineColorBySuffix(suffix)
            );
        });
    }

    private drawMeasurementConnections(
        measurementDefinition: MeasurementDefinition,
        keypointCenterMap: RenderableMeasurementCenterMap,
        data: EditorData
    ): void {
        if (!measurementDefinition.functionId) {
            return;
        }

        getMeasurementConnections(
            measurementDefinition.functionId,
            measurementDefinition.keypointIndexes.length
        ).forEach((connection) => {
            if (connection.type === "line") {
                this.drawMeasurementLineConnection(
                    measurementDefinition,
                    connection,
                    keypointCenterMap,
                    data
                );
            } else {
                this.drawMeasurementEllipseConnection(
                    measurementDefinition,
                    connection,
                    keypointCenterMap,
                    data
                );
            }
        });
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
                    data
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
                        data
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
                    data
                )
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
        newVertices: IPoint[]
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
                    this.activePath[0]
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
                                    index: number
                                ) => {
                                    if (indexUnderMouse === null) {
                                        const anchorOnCanvas: IPoint =
                                            RenderEngineUtil.transferPointFromImageToViewPortContent(
                                                anchor,
                                                data
                                            );
                                        if (
                                            this.isMouseOverAnchor(
                                                data.mousePositionOnViewPortContent,
                                                anchorOnCanvas
                                            )
                                        ) {
                                            return index;
                                        }
                                    }
                                    return indexUnderMouse;
                                },
                                null
                            );

                        if (anchorIndex !== null) {
                            this.startExistingLabelResize(
                                data,
                                polygonUnderMouse.id,
                                anchorIndex
                            );
                        } else {
                            store.dispatch(
                                updateActiveLabelId(polygonUnderMouse.id)
                            );
                            const isMouseOverNewAnchor: boolean =
                                this.isMouseOverAnchor(
                                    data.mousePositionOnViewPortContent,
                                    this.suggestedAnchorPositionOnCanvas
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
                                updateHighlightedLabelId(labelPolygon.id)
                            );
                        }
                        const pathOnCanvas: IPoint[] =
                            RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                                labelPolygon.vertices,
                                data
                            );
                        const linesOnCanvas: ILine[] =
                            PolygonUtil.getEdges(pathOnCanvas);

                        for (let j = 0; j < linesOnCanvas.length; j++) {
                            const mouseOverLine =
                                RenderEngineUtil.isMouseOverLine(
                                    data.mousePositionOnViewPortContent,
                                    linesOnCanvas[j],
                                    RenderEngineSettings.anchorHoverSize.width /
                                        2
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

    public canUndoLastAddedPoint(): boolean {
        return this.isCreationInProgress();
    }

    public undoLastAddedPoint(): void {
        if (this.canUndoLastAddedPoint()) {
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
                            this.activePath[0]
                        );
                    if (isMouseOverStartAnchor && this.activePath.length > 2)
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.CLOSE)
                        );
                    else
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.DEFAULT)
                        );
                } else {
                    const anchorUnderMouse: IPoint =
                        this.getAnchorUnderMouse(data);
                    const isMouseOverNewAnchor: boolean =
                        this.isMouseOverAnchor(
                            data.mousePositionOnViewPortContent,
                            this.suggestedAnchorPositionOnCanvas
                        );
                    if (!!isMouseOverNewAnchor) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.ADD)
                        );
                    } else if (this.isResizeInProgress()) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.MOVE)
                        );
                    } else if (!!anchorUnderMouse) {
                        store.dispatch(
                            updateCustomCursorStyle(CustomCursorStyle.MOVE)
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
            (point: IPoint) => RenderEngineUtil.setPointBetweenPixels(point)
        );
        const path = standardizedPoints.concat(
            data.mousePositionOnViewPortContent
        );
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(
            null,
            true
        );
        DrawUtil.drawPolygonWithFill(
            this.canvas,
            path,
            DrawUtil.hexToRGB(lineColor, 0.2)
        );
        DrawUtil.drawDashedPolygon(
            this.canvas,
            path,
            lineColor,
            RenderEngineSettings.LINE_THICKNESS,
            [8, 4],
            false
        );
        if (this.isDrawingEllipse)
            this.surfaceAnnotator.processAnnotation(
                this.canvas,
                data,
                standardizedPoints
            );
    }

    private drawActivelyResizeLabel(data: EditorData) {
        const activeLabelPolygon: LabelPolygon =
            LabelsSelector.getActivePolygonLabel();
        if (!!activeLabelPolygon && this.isResizeInProgress()) {
            const snappedMousePosition: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect
            );
            const polygonOnCanvas: IPoint[] = activeLabelPolygon.vertices.map(
                (point: IPoint, index: number) => {
                    return index === this.resizeAnchorIndex
                        ? snappedMousePosition
                        : RenderEngineUtil.transferPointFromImageToViewPortContent(
                              point,
                              data
                          );
                }
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
                        data
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
                        isActive
                    );
                }
            }
        });

        const renderableKeypointCenterMap =
            this.buildRenderableKeypointCenterMap();
        this.getMeasurementDefinitions().forEach((measurementDefinition) => {
            this.drawMeasurementConnections(
                measurementDefinition,
                renderableKeypointCenterMap,
                data
            );
        });
    }

    private drawPolygon(
        labelId: string | null,
        polygon: IPoint[],
        isActive: boolean
    ) {
        const lineColor: string = BaseRenderEngine.resolveLabelLineColor(
            labelId,
            true
        );
        const anchorColor: string =
            BaseRenderEngine.resolveLabelAnchorColor(true);
        const standardizedPoints: IPoint[] = polygon.map((point: IPoint) =>
            RenderEngineUtil.setPointBetweenPixels(point)
        );
        if (isActive) {
            DrawUtil.drawPolygonWithFill(
                this.canvas,
                standardizedPoints,
                DrawUtil.hexToRGB(lineColor, 0.2)
            );
        }
        DrawUtil.drawPolygon(
            this.canvas,
            standardizedPoints,
            lineColor,
            RenderEngineSettings.LINE_THICKNESS
        );
        if (isActive) {
            standardizedPoints.forEach((point: IPoint) => {
                DrawUtil.drawCircleWithFill(
                    this.canvas,
                    point,
                    Settings.RESIZE_HANDLE_DIMENSION_PX / 2,
                    anchorColor
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
                    RenderEngineSettings.suggestedAnchorDetectionSize
                );
            const isMouseOverSuggestedAnchor: boolean = RectUtil.isPointInside(
                suggestedAnchorRect,
                data.mousePositionOnViewPortContent
            );

            if (isMouseOverSuggestedAnchor) {
                DrawUtil.drawCircleWithFill(
                    this.canvas,
                    this.suggestedAnchorPositionOnCanvas,
                    Settings.RESIZE_HANDLE_DIMENSION_PX / 2,
                    anchorColor
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
        tolerance: number = 1
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
                            data.viewPortContentImageRect
                        );
                    if (
                        this.arePointsClose(
                            this.activePath[0],
                            mousePositionSnapped
                        )
                    ) {
                        this.addLabelAndFinishCreation(data);
                        return;
                    }
                }
            }
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(
                data.mousePositionOnViewPortContent,
                data.viewPortContentImageRect
            );
            this.activePath.push(mousePositionSnapped);
        } else {
            const isMouseOverImage: boolean = RectUtil.isPointInside(
                data.viewPortContentImageRect,
                data.mousePositionOnViewPortContent
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
        data: EditorData
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
            viewPortContentImageRect
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

        const targetVertexCount =
            GeneralSelector.getPolygonLassoTargetVertexCount() ||
            DEFAULT_LASSO_TARGET_VERTEX_COUNT;

        return pathLength / Math.max(3, targetVertexCount);
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
            normalizedPoints[normalizedPoints.length - 1]
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
                    data
                );
            const radius =
                Math.min(...Object.values(data.realImageSize)) *
                this.scaleFactor;

            if (this.activePath.length === 1) {
                // Single click + finish: create one keypoint with the active label
                const generatedPolygon = this.generatePolygonFromKeypoint(
                    polygonOnImage[0],
                    radius,
                    8
                );
                this.addPolygonLabel(generatedPolygon);
            } else {
                // Multiple clicks: assign sequentially from the start of the group
                const generatedPolygons = polygonOnImage.map((p) =>
                    this.generatePolygonFromKeypoint(p, radius, 8)
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
                    data
                );
            this.addPolygonLabel(polygonOnImage);
            this.finishLabelCreation();
        } else if (this.isCreationInProgress() && this.activePath.length == 1) {
            const polygonOnImage: IPoint[] =
                RenderEngineUtil.transferPolygonFromViewPortContentToImage(
                    this.activePath,
                    data
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
                    data
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
                        8
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
                    data
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
                        8
                    );
                generatedPolygons.push(generatedPolygonFromKeypoint);
            }
            this.addPolygonLabel3Keypoints(generatedPolygons);

            // Draw the ellipse
            let startPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[0]
            );
            let endPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[1]
            );
            let constrainPoint = RenderEngineUtil.setPointBetweenPixels(
                polygonOnImage[2]
            );

            this.surfaceAnnotator.drawEllipse(
                this.canvas,
                startPoint,
                endPoint,
                constrainPoint
            );
            this.finishLabelCreation();
        }
    }

    private addPolygonLabel(polygon: IPoint[]) {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelPolygon: LabelPolygon = LabelUtil.createLabelPolygon(
            activeLabelId,
            polygon
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

                const adjacentLabelName = activeLabelName.replace(
                    this.kptNameEndPattern,
                    (match) => (parseInt(match, 10) + 1).toString()
                );
                const adjacentLabelId = labelNameToIdMap[adjacentLabelName];
                if (adjacentLabelId) {
                    const labelPolygon1: LabelPolygon =
                        LabelUtil.createLabelPolygon(
                            adjacentLabelId,
                            polygons[1]
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
        const parsedKeypointName = parseKeypointName(labelName);
        if (!parsedKeypointName) {
            return null;
        }

        const measurementDefinition = this.getMeasurementDefinitions().find(
            (definition) =>
                definition.measurementName ===
                parsedKeypointName.measurementName
        );

        return measurementDefinition
            ? measurementDefinition.keypointNames
            : null;
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
                polygons[i]
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
                    (match) => (parseInt(match, 10) + 1).toString()
                );
                const nextLabelId1 = labelNameToIdMap[nextLabelName1];
                const nextLabelName2 = activeLabelName.replace(
                    this.kptNameEndPattern,
                    (match) => (parseInt(match, 10) + 2).toString()
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
        numberOfVertices: number
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
            (polygon) => polygon.id === polygonId
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
                    currPolygon
                );
                imageData.labelPolygons = this.removePolygonsInImageWithLabelId(
                    imageData,
                    labelId
                );
                imageData.labelPolygons.push(labelPolygonWithNewId);
            }
            store.dispatch(updateImageDataById(imageData.id, imageData));
            this.annotationsInMemory = [];
        }
    }

    private removePolygonsInImageWithLabelId(
        imageData: ImageData,
        labelId: string
    ) {
        return imageData.labelPolygons.filter(
            (polygon) => polygon.labelId != labelId
        );
    }

    // =================================================================================================================
    // TRANSFER
    // =================================================================================================================

    private startExistingLabelResize(
        data: EditorData,
        labelId: string,
        anchorIndex: number
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
                                            data.viewPortContentImageRect
                                        );
                                    return RenderEngineUtil.transferPointFromViewPortContentToImage(
                                        snappedMousePosition,
                                        data
                                    );
                                }
                            }
                        ),
                    };
                }
            }
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
                data
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
                                newAnchorPositionOnImage
                            ),
                        };
                    }
                }
            ),
        };

        store.dispatch(updateImageDataById(newImageData.id, newImageData));
        this.startExistingLabelResize(
            data,
            activeLabel.id,
            this.suggestedAnchorIndexInPolygon
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
                RenderEngineSettings.anchorSize
            ),
            mouse
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
                (labelPolygon: LabelPolygon) => labelPolygon.isVisible
            );
        const radius = RenderEngineSettings.anchorHoverSize.width / 2;

        for (const labelPolygon of labelPolygons) {
            const verticesOnCanvas =
                RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                    labelPolygon.vertices,
                    data
                );
            if (
                RenderEngineUtil.isMouseOverPolygon(
                    mouseOnCanvas,
                    verticesOnCanvas,
                    radius
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
                (labelPolygon: LabelPolygon) => labelPolygon.isVisible
            );
        const radius = RenderEngineSettings.anchorHoverSize.width / 2;

        for (const labelPolygon of labelPolygons) {
            const verticesOnCanvas =
                RenderEngineUtil.transferPolygonFromImageToViewPortContent(
                    labelPolygon.vertices,
                    data
                );
            for (const vertexOnCanvas of verticesOnCanvas) {
                if (
                    RenderEngineUtil.isMouseOverAnchor(
                        mouseOnCanvas,
                        vertexOnCanvas,
                        radius
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
        points: IPoint[]
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
                data.mousePositionOnViewPortContent
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
                    data.mousePositionOnViewPortContent
                );
            } else if (this.activeAnchorPoints.length == 3) {
                this.drawEllipse(
                    canvas,
                    startPoint,
                    endPoint,
                    this.activeAnchorPoints[2]
                );
            }
        } else {
            this.reset();
        }
    }

    public drawCircle(
        canvas: HTMLCanvasElement,
        startPoint: IPoint,
        endPoint: IPoint
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
        constrainPoint: IPoint
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
        color: string = "#ffffff"
    ) {
        const ellipseProperties = KeypointSurfaceAnnotation.computeEllipse(
            startPoint,
            endPoint,
            constrainPoint
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
            color
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
    public getKeypointsFromPolygons(): KeypointCenter[] {
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const labelMap = labelNames.reduce((map, label) => {
            map[label.id] = label.name;
            return map;
        }, {} as Record<string, string>);

        if (!imageData) {
            return [];
        }

        return imageData.labelPolygons
            .filter((annotation) => annotation.isVisible)
            .map((annotation) => {
                const labelName = annotation.labelId
                    ? labelMap[annotation.labelId] || null
                    : null;
                const parsedKeypointName = labelName
                    ? parseKeypointName(labelName)
                    : null;

                if (!labelName || !parsedKeypointName) {
                    return null;
                }

                return {
                    id: annotation.id,
                    labelName,
                    measurementName: parsedKeypointName.measurementName,
                    keypointIndex: parsedKeypointName.keypointIndex,
                    suffix: parsedKeypointName.suffix,
                    centroid: this.computeCentroid(annotation),
                };
            })
            .filter((keypoint): keypoint is KeypointCenter => !!keypoint);
    }

    public buildMeasurements(): Array<number | null> {
        return this.buildMeasurementResults().map((result) => result.value);
    }

    public buildMeasurementResults(): MeasurementResult[] {
        const allKeypointCenters = this.getKeypointsFromPolygons();
        const measurementDefinitions = inferMeasurementDefinitions(
            LabelsSelector.getLabelNames(),
            GeneralSelector.getMeasurementFunctionByName()
        );

        return measurementDefinitions.map((measurementDefinition) => ({
            measurementName: measurementDefinition.measurementName,
            displayName: measurementDefinition.displayName,
            functionId: measurementDefinition.functionId,
            functionName: measurementDefinition.functionName,
            value: this.computeMeasurementValue(
                allKeypointCenters,
                measurementDefinition
            ),
            unit:
                measurementDefinition.functionId === MeasurementFunctionId.ANGLE
                    ? "degree"
                    : null,
        }));
    }

    public buildMeasurementResult(
        measurementName: string
    ): MeasurementResult | null {
        return (
            this.buildMeasurementResults().find(
                (measurementResult) =>
                    measurementResult.measurementName === measurementName
            ) || null
        );
    }

    public computeCentroid(polygon: LabelPolygon): IPoint {
        const { vertices } = polygon;

        if (vertices.length === 0) {
            throw new Error("No vertices in the polygon");
        }

        const sum = vertices.reduce(
            (acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            },
            { x: 0, y: 0 }
        );

        return {
            x: sum.x / vertices.length,
            y: sum.y / vertices.length,
        };
    }

    private computeMeasurementValue(
        keypointCenters: KeypointCenter[],
        measurementDefinition: MeasurementDefinition
    ): number | null {
        if (!measurementDefinition.functionId) {
            return null;
        }

        const orderedKeypoints = this.getOrderedKeypointsForDefinition(
            keypointCenters,
            measurementDefinition
        );
        if (!orderedKeypoints) {
            return null;
        }

        switch (measurementDefinition.functionId) {
            case MeasurementFunctionId.CHAIN_DISTANCE_RATIO:
                return this.computeChainDistanceRatio(orderedKeypoints);
            case MeasurementFunctionId.CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO:
                return this.computeClosedTriangleInverseDistanceRatio(
                    orderedKeypoints
                );
            case MeasurementFunctionId.PAIRED_DISTANCE_RATIO:
                return this.computePairedDistanceRatio(orderedKeypoints);
            case MeasurementFunctionId.INVERSE_PAIRED_DISTANCE_RATIO:
                return this.computeInversePairedDistanceRatio(orderedKeypoints);
            case MeasurementFunctionId.ANCHORED_DISTANCE_RATIO:
                return this.computeAnchoredDistanceRatio(orderedKeypoints);
            case MeasurementFunctionId.TERMINAL_DISTANCE_RATIO:
                return this.computeTerminalDistanceRatio(orderedKeypoints);
            case MeasurementFunctionId.ANGLE:
                return this.computeAngle(orderedKeypoints);
            case MeasurementFunctionId.SURFACE_ELLIPSE_AREA_RATIO:
                return this.computeSurfaceRatio(orderedKeypoints);
            case MeasurementFunctionId.POSITION_ELLIPSE_SPLIT_RATIO:
                return this.computePositionRatio(orderedKeypoints);
            case MeasurementFunctionId.PROJECTED_DISTANCE_RATIO:
                return this.computeDistanceRatioWithProjection(
                    orderedKeypoints
                );
            default:
                return null;
        }
    }

    private getOrderedKeypointsForDefinition(
        keypointCenters: KeypointCenter[],
        measurementDefinition: MeasurementDefinition
    ): KeypointCenter[] | null {
        const measurementKeypoints = keypointCenters.filter(
            (keypointCenter) =>
                keypointCenter.measurementName ===
                measurementDefinition.measurementName
        );
        const suffixes = Array.from(
            new Set(measurementKeypoints.map((keypoint) => keypoint.suffix))
        ).sort((first, second) => {
            if (first === "") return -1;
            if (second === "") return 1;
            return first.localeCompare(second);
        });

        const requiredKeypointIndexes = measurementDefinition.functionId
            ? measurementDefinition.keypointIndexes.slice(
                  0,
                  getMinimumKeypointCount(
                      getMeasurementFunctionConfig(
                          measurementDefinition.functionId
                      )
                  )
              )
            : measurementDefinition.keypointIndexes;

        for (const suffix of suffixes) {
            const orderedKeypoints = requiredKeypointIndexes.map(
                (keypointIndex) =>
                    measurementKeypoints.find(
                        (keypoint) =>
                            keypoint.keypointIndex === keypointIndex &&
                            keypoint.suffix === suffix
                    )
            );

            if (
                orderedKeypoints.every(
                    (keypoint): keypoint is KeypointCenter => !!keypoint
                )
            ) {
                return orderedKeypoints;
            }
        }

        return null;
    }

    private computeDistance(point1: IPoint, point2: IPoint): number {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private computeDistanceRatio(
        numeratorStart: IPoint,
        numeratorEnd: IPoint,
        denominatorStart: IPoint,
        denominatorEnd: IPoint
    ): number {
        return (
            this.computeDistance(numeratorStart, numeratorEnd) /
            (this.computeDistance(denominatorStart, denominatorEnd) + 1e-6)
        );
    }

    private computeChainDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 3) {
            return null;
        }

        const [point1, point2, point3] = keypoints;
        return this.computeDistanceRatio(
            point2.centroid,
            point3.centroid,
            point1.centroid,
            point2.centroid
        );
    }

    private computeClosedTriangleInverseDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 3) {
            return null;
        }

        const [point1, point2, point3] = keypoints;
        return this.computeDistanceRatio(
            point1.centroid,
            point2.centroid,
            point2.centroid,
            point3.centroid
        );
    }

    private computePairedDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 4) {
            return null;
        }

        const [point1, point2, point3, point4] = keypoints;
        return this.computeDistanceRatio(
            point3.centroid,
            point4.centroid,
            point1.centroid,
            point2.centroid
        );
    }

    private computeInversePairedDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 4) {
            return null;
        }

        const [point1, point2, point3, point4] = keypoints;
        return this.computeDistanceRatio(
            point1.centroid,
            point2.centroid,
            point3.centroid,
            point4.centroid
        );
    }

    private computeAnchoredDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 3) {
            return null;
        }

        const [point1, point2, point3] = keypoints;
        return this.computeDistanceRatio(
            point1.centroid,
            point2.centroid,
            point3.centroid,
            point1.centroid
        );
    }

    private computeTerminalDistanceRatio(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 3) {
            return null;
        }

        const [point1, point2, point3] = keypoints;
        return this.computeDistanceRatio(
            point3.centroid,
            point2.centroid,
            point1.centroid,
            point3.centroid
        );
    }

    private computeVector(point1: IPoint, point2: IPoint): IPoint {
        return {
            x: point1.x - point2.x,
            y: point1.y - point2.y,
        };
    }

    private computeAngle(keypoints: KeypointCenter[]): number | null {
        if (keypoints.length < 5) {
            return null;
        }

        const [point1, point2, point3, point4, point5] = keypoints;
        const vect1 = this.computeVector(point1.centroid, point2.centroid);
        const vect2 = this.computeVector(point3.centroid, point4.centroid);
        const angle =
            (Math.atan2(
                vect1.x * vect2.y - vect1.y * vect2.x,
                vect1.x * vect2.x + vect1.y * vect2.y
            ) *
                180) /
            Math.PI;

        const vect3 = this.computeVector(point5.centroid, point4.centroid);
        const sign = Math.sign(vect2.x * vect3.y - vect2.y * vect3.x);
        return sign * angle;
    }

    private findLineEquationFromNormalVectorAnd1Point(
        normalVector: IPoint,
        point: IPoint
    ) {
        const a = normalVector.x;
        const b = normalVector.y;
        const c = -a * point.x - b * point.y;

        return [a, b, c];
    }

    private projectPointOntoLine(lineParams: number[], point: IPoint) {
        const [a1, b1, c1] = lineParams;
        const a2 = b1;
        const b2 = -a1;
        const c2 = -a2 * point.x - b2 * point.y;
        const x = -(c1 * b2 - c2 * b1) / (a1 * b2 - a2 * b1);
        return {
            x: x,
            y: (-c1 - a1 * x) / b1,
        };
    }

    private projectPointOntoLineByPoints(
        linePoint1: IPoint,
        linePoint2: IPoint,
        point: IPoint
    ): IPoint | null {
        const dx = linePoint2.x - linePoint1.x;
        const dy = linePoint2.y - linePoint1.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared === 0) {
            return null;
        }

        const t =
            ((point.x - linePoint1.x) * dx + (point.y - linePoint1.y) * dy) /
            lengthSquared;

        return {
            x: linePoint1.x + t * dx,
            y: linePoint1.y + t * dy,
        };
    }

    private computeDistanceRatioWithProjection(
        keypoints: KeypointCenter[]
    ): number | null {
        if (keypoints.length < 3) {
            return null;
        }

        const [point1, point2, point3] = keypoints;
        const linePoint1 = point3.centroid;
        const linePoint2 = {
            x: point3.centroid.x + point2.centroid.x - point1.centroid.x,
            y: point3.centroid.y + point2.centroid.y - point1.centroid.y,
        };
        const projectedPoint = this.projectPointOntoLineByPoints(
            linePoint1,
            linePoint2,
            point1.centroid
        );
        if (!projectedPoint) {
            return null;
        }

        return this.computeDistanceRatio(
            projectedPoint,
            point3.centroid,
            point1.centroid,
            point2.centroid
        );
    }

    private computeEllipseArea(majorAxis: number, minorAxis: number) {
        return Math.PI * majorAxis * minorAxis;
    }

    private computeSurfaceRatio(keypoints: KeypointCenter[]): number | null {
        if (keypoints.length < 6) {
            return null;
        }

        const [point1, point2, point3, point4, point5, point6] = keypoints;
        const propertiesEllipse1 = KeypointSurfaceAnnotation.computeEllipse(
            point4.centroid,
            point5.centroid,
            point6.centroid
        );
        const propertiesEllipse2 = KeypointSurfaceAnnotation.computeEllipse(
            point1.centroid,
            point2.centroid,
            point3.centroid
        );
        const areaEllipse1 = this.computeEllipseArea(
            propertiesEllipse1.majorAxis,
            propertiesEllipse1.minorAxis
        );
        const areaEllipse2 = this.computeEllipseArea(
            propertiesEllipse2.majorAxis,
            propertiesEllipse2.minorAxis
        );

        return areaEllipse1 / (areaEllipse2 + 1e-6);
    }

    private findEllipseKeypoints(
        ellipseKp1: IPoint,
        ellipseKp2: IPoint,
        ellipseKp3: IPoint,
        nbPoints: number = 4
    ) {
        if (nbPoints < 4) {
            throw new Error("Number of points must be at least 4");
        }
        const propertiesEllipse = KeypointSurfaceAnnotation.computeEllipse(
            ellipseKp1,
            ellipseKp2,
            ellipseKp3
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

        const rotMatInverted = [
            [Math.cos(angleRad), -Math.sin(angleRad)],
            [Math.sin(angleRad), Math.cos(angleRad)],
        ];

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

        const ellipsePoints = [kp1, kp2, kp3, kp4];
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
        let cx = 0,
            cy = 0;
        for (const point of points) {
            cx += point[0];
            cy += point[1];
        }
        cx /= points.length;
        cy /= points.length;

        const pointsWithAngles = points.map((point) => {
            const angle = Math.atan2(point[1] - cy, point[0] - cx);
            return { point, angle };
        });
        pointsWithAngles.sort((a, b) => a.angle - b.angle);

        return pointsWithAngles.map((item) => item.point);
    }

    private pointsToLineSign(linePoint1, linePoint2, points) {
        const p1 = [linePoint1.x, linePoint1.y];
        const p2 = [linePoint2.x, linePoint2.y];
        const vectLine = [p2[0] - p1[0], p2[1] - p1[1]];
        const vectsPointsP1 = points.map((point) => [
            point[0] - p1[0],
            point[1] - p1[1],
        ]);
        const crossProd = vectsPointsP1.map(
            (vect) => vectLine[0] * vect[1] - vectLine[1] * vect[0]
        );

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
        nbApproxPointsEllipse
    ) {
        const [ellipsePoints, majorAxis, minorAxis] = this.findEllipseKeypoints(
            ellipseP1,
            ellipseP2,
            ellipseP3,
            nbApproxPointsEllipse
        );

        const kp1 = ellipsePoints[0];
        const kp2 = ellipsePoints[1];
        const kp3 = ellipsePoints[2];
        const vectKp2Kp1 = [kp2[0] - kp1[0], kp2[1] - kp1[1]];
        const vectKp3Kp1 = [kp3[0] - kp1[0], kp3[1] - kp1[1]];
        const sign = Math.sign(
            vectKp2Kp1[0] * vectKp3Kp1[1] - vectKp2Kp1[1] * vectKp3Kp1[0]
        );
        const orderedPoints = this.orderPointsCounterclockwise(ellipsePoints);
        const signs = this.pointsToLineSign(
            linePoint1,
            linePoint2,
            orderedPoints
        ).map((s) => !!(sign * s > 0));
        const ellipsePointsForRatio = orderedPoints.filter(
            (_, i) => signs[i] === true
        );

        return (
            this.computePolygonAreaShoelace(ellipsePointsForRatio) /
            (Math.PI * (majorAxis as number) * (minorAxis as number) + 1e-6)
        );
    }

    private computePositionRatio(keypoints: KeypointCenter[]): number | null {
        if (keypoints.length < 5) {
            return null;
        }

        const [point1, point2, point3, point4, point5] = keypoints;
        return this.calculateEllipseRatioByPolygon(
            point3.centroid,
            point4.centroid,
            point5.centroid,
            point1.centroid,
            point2.centroid,
            1000
        );
    }
}
