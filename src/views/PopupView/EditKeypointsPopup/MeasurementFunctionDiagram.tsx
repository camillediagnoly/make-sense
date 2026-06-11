import React from "react";
import { MeasurementFunctionId } from "../../../data/measurements/MeasurementFunctionData";

type DiagramPoint = {
    x: number;
    y: number;
    label: string;
    labelDx?: number;
    labelDy?: number;
};

interface IProps {
    functionId: MeasurementFunctionId;
    compact?: boolean;
}

const Line = ({
    from,
    to,
    className,
}: {
    from: DiagramPoint;
    to: DiagramPoint;
    className: string;
}) => (
    <line className={className} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
);

const Point = ({ point }: { point: DiagramPoint }) => (
    <g>
        <circle className="DiagramPoint" cx={point.x} cy={point.y} r="3.4" />
        <text
            className="DiagramPointLabel"
            x={point.x + (point.labelDx || 0)}
            y={point.y + (point.labelDy ?? -7)}
        >
            {point.label}
        </text>
    </g>
);

const Points = ({ points }: { points: DiagramPoint[] }) => (
    <>
        {points.map((point) => (
            <Point key={point.label} point={point} />
        ))}
    </>
);

const renderDiagram = (functionId: MeasurementFunctionId) => {
    switch (functionId) {
        case MeasurementFunctionId.CHAIN_DISTANCE_RATIO: {
            const p1 = { x: 18, y: 48, label: "p1" };
            const p2 = { x: 60, y: 18, label: "p2" };
            const p3 = { x: 102, y: 48, label: "p3" };
            return (
                <>
                    <Line
                        from={p1}
                        to={p2}
                        className="DiagramLine denominator"
                    />
                    <Line from={p2} to={p3} className="DiagramLine numerator" />
                    <Points points={[p1, p2, p3]} />
                </>
            );
        }
        case MeasurementFunctionId.CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO: {
            const p1 = { x: 18, y: 48, label: "p1" };
            const p2 = { x: 60, y: 18, label: "p2" };
            const p3 = { x: 102, y: 48, label: "p3" };
            return (
                <>
                    <Line from={p1} to={p2} className="DiagramLine numerator" />
                    <Line
                        from={p2}
                        to={p3}
                        className="DiagramLine denominator"
                    />
                    <Points points={[p1, p2, p3]} />
                </>
            );
        }
        case MeasurementFunctionId.PAIRED_DISTANCE_RATIO: {
            const p1 = { x: 60, y: 8, label: "p1", labelDy: -8 };
            const p2 = { x: 60, y: 60, label: "p2", labelDy: 8 };
            const p3 = { x: 88, y: 36, label: "p3", labelDx: 10, labelDy: 0 };
            const p4 = { x: 32, y: 36, label: "p4", labelDx: -10, labelDy: 0 };
            return (
                <>
                    <Line
                        from={p1}
                        to={p2}
                        className="DiagramLine denominator"
                    />
                    <Line from={p3} to={p4} className="DiagramLine numerator" />
                    <Points points={[p1, p2, p3, p4]} />
                </>
            );
        }
        case MeasurementFunctionId.INVERSE_PAIRED_DISTANCE_RATIO: {
            const p1 = { x: 60, y: 8, label: "p1", labelDy: -8 };
            const p2 = { x: 60, y: 60, label: "p2", labelDy: 8 };
            const p3 = { x: 88, y: 36, label: "p3", labelDx: 10, labelDy: 0 };
            const p4 = { x: 32, y: 36, label: "p4", labelDx: -10, labelDy: 0 };
            return (
                <>
                    <Line from={p1} to={p2} className="DiagramLine numerator" />
                    <Line
                        from={p3}
                        to={p4}
                        className="DiagramLine denominator"
                    />
                    <Points points={[p1, p2, p3, p4]} />
                </>
            );
        }
        case MeasurementFunctionId.ANCHORED_DISTANCE_RATIO: {
            const p1 = { x: 60, y: 18, label: "p1" };
            const p2 = { x: 102, y: 48, label: "p2" };
            const p3 = { x: 18, y: 48, label: "p3" };
            return (
                <>
                    <Line
                        from={p3}
                        to={p1}
                        className="DiagramLine denominator"
                    />
                    <Line from={p1} to={p2} className="DiagramLine numerator" />
                    <Points points={[p1, p2, p3]} />
                </>
            );
        }
        case MeasurementFunctionId.TERMINAL_DISTANCE_RATIO: {
            const p1 = { x: 18, y: 48, label: "p1" };
            const p2 = { x: 102, y: 48, label: "p2" };
            const p3 = { x: 60, y: 18, label: "p3" };
            return (
                <>
                    <Line
                        from={p1}
                        to={p3}
                        className="DiagramLine denominator"
                    />
                    <Line from={p3} to={p2} className="DiagramLine numerator" />
                    <Points points={[p1, p2, p3]} />
                </>
            );
        }
        case MeasurementFunctionId.ANGLE: {
            const p1 = { x: 60, y: 8, label: "p1", labelDy: -8 };
            const p2 = { x: 60, y: 60, label: "p2", labelDy: 8 };
            const p3 = { x: 28, y: 21, label: "p3", labelDx: -8, labelDy: -5 };
            const p4 = { x: 86, y: 48, label: "p4", labelDx: 8, labelDy: 6 };
            return (
                <>
                    <Line
                        from={p1}
                        to={p2}
                        className="DiagramLine denominator"
                    />
                    <Line from={p3} to={p4} className="DiagramLine numerator" />
                    <path
                        className="DiagramArc"
                        d="M 60 22 A 19 19 0 0 0 45 29"
                    />
                    <Points points={[p1, p2, p3, p4]} />
                </>
            );
        }
        case MeasurementFunctionId.SURFACE_ELLIPSE_AREA_RATIO:
            return (
                <>
                    <ellipse
                        className="DiagramEllipse denominator"
                        cx="62"
                        cy="36"
                        rx="49"
                        ry="25"
                        transform="rotate(-12 62 36)"
                    />
                    <ellipse
                        className="DiagramEllipse numerator"
                        cx="62"
                        cy="36"
                        rx="24"
                        ry="12"
                        transform="rotate(-12 62 36)"
                    />
                    <Points
                        points={[
                            {
                                x: 18,
                                y: 45,
                                label: "p1",
                                labelDx: -8,
                                labelDy: 10,
                            },
                            {
                                x: 104,
                                y: 27,
                                label: "p2",
                                labelDx: 8,
                                labelDy: -2,
                            },
                            { x: 58, y: 14, label: "p3", labelDy: -8 },
                            {
                                x: 40,
                                y: 40,
                                label: "p4",
                                labelDx: -8,
                                labelDy: 9,
                            },
                            {
                                x: 84,
                                y: 31,
                                label: "p5",
                                labelDx: 8,
                                labelDy: -1,
                            },
                            { x: 61, y: 48, label: "p6", labelDy: 10 },
                        ]}
                    />
                </>
            );
        case MeasurementFunctionId.POSITION_ELLIPSE_SPLIT_RATIO: {
            const p1 = { x: 10, y: 56, label: "p1" };
            const p2 = { x: 112, y: 18, label: "p2" };
            return (
                <>
                    <path
                        className="DiagramArea numerator"
                        d="M 30.5 48.36 A 34 18 -18 0 1 94.04 24.69 L 30.5 48.36 Z"
                    />
                    <ellipse
                        className="DiagramEllipse denominator"
                        cx="62"
                        cy="36"
                        rx="34"
                        ry="18"
                        transform="rotate(-18 62 36)"
                    />
                    <Line from={p1} to={p2} className="DiagramLine neutral" />
                    <Points
                        points={[
                            { ...p1, labelDx: -5, labelDy: -10 },
                            { ...p2, labelDx: 0, labelDy: -10 },
                            { x: 34, y: 48, label: "p3", labelDy: 12 },
                            {
                                x: 90,
                                y: 26,
                                label: "p4",
                                labelDx: -10,
                                labelDy: 10,
                            },
                            { x: 62, y: 17, label: "p5", labelDy: -11 },
                        ]}
                    />
                </>
            );
        }
        case MeasurementFunctionId.PROJECTED_DISTANCE_RATIO: {
            const p1 = { x: 22, y: 48, label: "p1" };
            const p2 = { x: 84, y: 48, label: "p2" };
            const p3 = { x: 62, y: 18, label: "p3" };
            const projection = { x: 22, y: 18, label: "" };
            return (
                <>
                    <Line
                        from={p1}
                        to={p2}
                        className="DiagramLine denominator"
                    />
                    <Line
                        from={projection}
                        to={p3}
                        className="DiagramLine numerator"
                    />
                    <Line
                        from={p1}
                        to={projection}
                        className="DiagramLine guide"
                    />
                    <Points points={[p1, p2, p3]} />
                    <circle
                        className="DiagramPoint projected"
                        cx={projection.x}
                        cy={projection.y}
                        r="3"
                    />
                </>
            );
        }
        default:
            return null;
    }
};

export const MeasurementFunctionDiagram: React.FC<IProps> = ({
    functionId,
    compact = false,
}) => (
    <svg
        className={
            compact
                ? "MeasurementFunctionDiagram compact"
                : "MeasurementFunctionDiagram"
        }
        viewBox="0 0 120 68"
        role="img"
        aria-label="Measurement function diagram"
    >
        {renderDiagram(functionId)}
    </svg>
);
