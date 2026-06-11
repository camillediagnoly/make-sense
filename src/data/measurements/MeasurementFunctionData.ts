export enum MeasurementFunctionId {
    CHAIN_DISTANCE_RATIO = "CHAIN_DISTANCE_RATIO",
    CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO = "CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO",
    PAIRED_DISTANCE_RATIO = "PAIRED_DISTANCE_RATIO",
    INVERSE_PAIRED_DISTANCE_RATIO = "INVERSE_PAIRED_DISTANCE_RATIO",
    ANCHORED_DISTANCE_RATIO = "ANCHORED_DISTANCE_RATIO",
    TERMINAL_DISTANCE_RATIO = "TERMINAL_DISTANCE_RATIO",
    ANGLE = "ANGLE",
    SURFACE_ELLIPSE_AREA_RATIO = "SURFACE_ELLIPSE_AREA_RATIO",
    POSITION_ELLIPSE_SPLIT_RATIO = "POSITION_ELLIPSE_SPLIT_RATIO",
    PROJECTED_DISTANCE_RATIO = "PROJECTED_DISTANCE_RATIO",
}

export type MeasurementFunctionByName = Record<string, MeasurementFunctionId>;

export type ParsedKeypointName = {
    measurementName: string;
    keypointIndex: number;
    suffix: string;
    baseKeypointName: string;
};

export type MeasurementFunctionConfig = {
    id: MeasurementFunctionId;
    name: string;
    compatibleKeypointCounts: number[];
};

export function getMinimumKeypointCount(
    config: MeasurementFunctionConfig
): number {
    return Math.min(...config.compatibleKeypointCounts);
}

export type MeasurementConnection =
    | {
          type: "line";
          fromPosition: number;
          toPosition: number;
      }
    | {
          type: "ellipse";
          firstPosition: number;
          secondPosition: number;
          thirdPosition: number;
      };

export type MeasurementDefinition = {
    measurementName: string;
    displayName: string;
    functionId: MeasurementFunctionId | null;
    functionName: string;
    keypointIndexes: number[];
    keypointNames: string[];
};

export const MEASUREMENT_FUNCTIONS: MeasurementFunctionConfig[] = [
    {
        id: MeasurementFunctionId.CHAIN_DISTANCE_RATIO,
        name: "Distance Ratio 1",
        compatibleKeypointCounts: [3],
    },
    {
        id: MeasurementFunctionId.CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO,
        name: "Distance Ratio 2",
        compatibleKeypointCounts: [3],
    },
    {
        id: MeasurementFunctionId.ANCHORED_DISTANCE_RATIO,
        name: "Distance Ratio 3",
        compatibleKeypointCounts: [3],
    },
    {
        id: MeasurementFunctionId.TERMINAL_DISTANCE_RATIO,
        name: "Distance Ratio 4",
        compatibleKeypointCounts: [3],
    },
    {
        id: MeasurementFunctionId.PAIRED_DISTANCE_RATIO,
        name: "Paired Distance Ratio",
        compatibleKeypointCounts: [4],
    },
    {
        id: MeasurementFunctionId.INVERSE_PAIRED_DISTANCE_RATIO,
        name: "Inverse Paired Distance Ratio",
        compatibleKeypointCounts: [4],
    },
    {
        id: MeasurementFunctionId.ANGLE,
        name: "Angle",
        compatibleKeypointCounts: [5],
    },
    {
        id: MeasurementFunctionId.SURFACE_ELLIPSE_AREA_RATIO,
        name: "Ellipse Area Ratio",
        compatibleKeypointCounts: [6],
    },
    {
        id: MeasurementFunctionId.POSITION_ELLIPSE_SPLIT_RATIO,
        name: "Ellipse Split Ratio",
        compatibleKeypointCounts: [5],
    },
    {
        id: MeasurementFunctionId.PROJECTED_DISTANCE_RATIO,
        name: "Projected Distance Ratio",
        compatibleKeypointCounts: [3],
    },
];

const KEYPOINT_NAME_PATTERN = /^(.+\.k:.+)-(\d+)(.*)$/;

export function parseKeypointName(
    labelName: string
): ParsedKeypointName | null {
    const match = labelName.match(KEYPOINT_NAME_PATTERN);
    if (!match) {
        return null;
    }

    const measurementName = match[1];
    const keypointIndex = parseInt(match[2], 10);
    if (!Number.isFinite(keypointIndex)) {
        return null;
    }

    return {
        measurementName,
        keypointIndex,
        suffix: match[3] || "",
        baseKeypointName: getMeasurementKeypointName(
            measurementName,
            keypointIndex
        ),
    };
}

export function getMeasurementKeypointName(
    measurementName: string,
    keypointIndex: number
): string {
    return `${measurementName}-${keypointIndex}`;
}

export function getMeasurementFunctionConfig(
    functionId: MeasurementFunctionId
): MeasurementFunctionConfig {
    return (
        MEASUREMENT_FUNCTIONS.find((config) => config.id === functionId) ||
        MEASUREMENT_FUNCTIONS[0]
    );
}

export function getCompatibleMeasurementFunctions(
    keypointCount: number
): MeasurementFunctionConfig[] {
    return MEASUREMENT_FUNCTIONS.filter(
        (config) => keypointCount >= getMinimumKeypointCount(config)
    );
}

export function isMeasurementFunctionId(
    value: any
): value is MeasurementFunctionId {
    return (Object.values(MeasurementFunctionId) as string[]).includes(value);
}

export function isMeasurementFunctionCompatible(
    functionId: MeasurementFunctionId,
    keypointCount: number
): boolean {
    return (
        keypointCount >=
        getMinimumKeypointCount(getMeasurementFunctionConfig(functionId))
    );
}

export function formatMeasurementDisplayName(measurementName: string): string {
    const match = measurementName.match(/^p-([a-z]+)\.k:(.+)$/i);
    if (!match) {
        return measurementName;
    }

    return `${match[1].toUpperCase()}-${match[2]}`;
}

export function getMeasurementConnections(
    functionId: MeasurementFunctionId,
    keypointCount: number
): MeasurementConnection[] {
    switch (functionId) {
        case MeasurementFunctionId.CHAIN_DISTANCE_RATIO:
            return [
                { type: "line", fromPosition: 0, toPosition: 1 },
                { type: "line", fromPosition: 1, toPosition: 2 },
            ];
        case MeasurementFunctionId.CLOSED_TRIANGLE_INVERSE_DISTANCE_RATIO:
            return [
                { type: "line", fromPosition: 0, toPosition: 1 },
                { type: "line", fromPosition: 1, toPosition: 2 },
                { type: "line", fromPosition: 2, toPosition: 0 },
            ];
        case MeasurementFunctionId.PAIRED_DISTANCE_RATIO:
        case MeasurementFunctionId.INVERSE_PAIRED_DISTANCE_RATIO:
            return [
                { type: "line", fromPosition: 0, toPosition: 1 },
                { type: "line", fromPosition: 2, toPosition: 3 },
            ];
        case MeasurementFunctionId.TERMINAL_DISTANCE_RATIO:
            return [
                { type: "line", fromPosition: 0, toPosition: 2 },
                { type: "line", fromPosition: 2, toPosition: 1 },
            ];
        case MeasurementFunctionId.ANGLE:
            return [
                { type: "line", fromPosition: 0, toPosition: 1 },
                { type: "line", fromPosition: 2, toPosition: 3 },
            ];
        case MeasurementFunctionId.SURFACE_ELLIPSE_AREA_RATIO:
            return [
                {
                    type: "ellipse",
                    firstPosition: 0,
                    secondPosition: 1,
                    thirdPosition: 2,
                },
                {
                    type: "ellipse",
                    firstPosition: 3,
                    secondPosition: 4,
                    thirdPosition: 5,
                },
            ];
        case MeasurementFunctionId.POSITION_ELLIPSE_SPLIT_RATIO:
            return [
                { type: "line", fromPosition: 0, toPosition: 1 },
                {
                    type: "ellipse",
                    firstPosition: 2,
                    secondPosition: 3,
                    thirdPosition: 4,
                },
            ];
        case MeasurementFunctionId.PROJECTED_DISTANCE_RATIO:
            return [{ type: "line", fromPosition: 0, toPosition: 1 }];
        case MeasurementFunctionId.ANCHORED_DISTANCE_RATIO:
        default:
            return [];
    }
}

export function inferMeasurementDefinitions(
    labelNames: Array<{ name: string }>,
    measurementFunctionByName: MeasurementFunctionByName = {}
): MeasurementDefinition[] {
    const indexByMeasurementName = new Map<string, Set<number>>();

    labelNames.forEach((labelName) => {
        const parsed = parseKeypointName(labelName.name);
        if (!parsed) {
            return;
        }

        const indexSet =
            indexByMeasurementName.get(parsed.measurementName) ||
            new Set<number>();
        indexSet.add(parsed.keypointIndex);
        indexByMeasurementName.set(parsed.measurementName, indexSet);
    });

    return Array.from(indexByMeasurementName.entries())
        .map(([measurementName, indexSet]) => {
            const keypointIndexes = Array.from(indexSet).sort(
                (first, second) => first - second
            );
            const functionId = resolveMeasurementFunctionId(
                measurementName,
                measurementFunctionByName
            );
            const functionConfig = functionId
                ? getMeasurementFunctionConfig(functionId)
                : null;

            return {
                measurementName,
                displayName: formatMeasurementDisplayName(measurementName),
                functionId,
                functionName: functionConfig
                    ? functionConfig.name
                    : "Not selected",
                keypointIndexes,
                keypointNames: keypointIndexes.map((keypointIndex) =>
                    getMeasurementKeypointName(measurementName, keypointIndex)
                ),
            };
        })
        .sort((first, second) =>
            first.displayName.localeCompare(second.displayName)
        );
}

export function resolveMeasurementFunctionId(
    measurementName: string,
    measurementFunctionByName: MeasurementFunctionByName = {}
): MeasurementFunctionId | null {
    const configuredFunctionId = measurementFunctionByName[measurementName];
    return configuredFunctionId && isMeasurementFunctionId(configuredFunctionId)
        ? configuredFunctionId
        : null;
}
