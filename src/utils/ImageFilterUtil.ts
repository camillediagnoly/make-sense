import {
    ImageData,
    LabelLine,
    LabelPoint,
    LabelPolygon,
    LabelRect,
} from "../store/labels/types";
import { LabelType } from "../data/enums/LabelType";
import { LabelStatus } from "../data/enums/LabelStatus";
import { ImageFilterMode } from "../data/enums/ImageFilterMode";
import {
    ImageClassBooleanOperator,
    ImageClassCriteria,
    ImageClassExpressionCriteria,
    LegacyImageClassCriteria,
} from "../store/general/types";
import { ImageGroupUtil } from "./ImageGroupUtil";

type CriteriaAstNode =
    | {
        type: "label";
        labelId: string;
    }
    | {
        type: "otherLabels";
    }
    | {
        type: "not";
        child: CriteriaAstNode;
    }
    | {
        type: "and" | "or";
        left: CriteriaAstNode;
        right: CriteriaAstNode;
    };

export class ImageFilterUtil {
    public static isImageLabeled(imageData: ImageData, labelType: LabelType): boolean {
        switch (labelType) {
            case LabelType.LINE:
                return imageData.labelLines.length > 0;
            case LabelType.IMAGE_RECOGNITION:
                return imageData.labelNameIds.length > 0;
            case LabelType.POINT:
                return imageData.labelPoints
                    .filter((labelPoint: LabelPoint) => labelPoint.status === LabelStatus.ACCEPTED)
                    .length > 0;
            case LabelType.POLYGON:
                return imageData.labelPolygons.length > 0;
            case LabelType.RECT:
                return imageData.labelRects
                    .filter((labelRect: LabelRect) => labelRect.status === LabelStatus.ACCEPTED)
                    .length > 0;
            default:
                return false;
        }
    }

    private static getImageAssignedLabelIds(imageData: ImageData): Set<string> {
        const assignedLabelIds = new Set<string>(imageData.labelNameIds || []);
        assignedLabelIds.add(
            ImageGroupUtil.getGroupFilterTokenId(
                ImageGroupUtil.getImageGroupName(imageData)
            )
        );

        imageData.labelRects
            .filter(
                (labelRect: LabelRect) =>
                    labelRect.status === LabelStatus.ACCEPTED && !!labelRect.labelId
            )
            .forEach((labelRect: LabelRect) => {
                if (labelRect.labelId) {
                    assignedLabelIds.add(labelRect.labelId);
                }
            });

        imageData.labelPoints
            .filter(
                (labelPoint: LabelPoint) =>
                    labelPoint.status === LabelStatus.ACCEPTED && !!labelPoint.labelId
            )
            .forEach((labelPoint: LabelPoint) => {
                if (labelPoint.labelId) {
                    assignedLabelIds.add(labelPoint.labelId);
                }
            });

        imageData.labelPolygons
            .filter((labelPolygon: LabelPolygon) => !!labelPolygon.labelId)
            .forEach((labelPolygon: LabelPolygon) => {
                if (labelPolygon.labelId) {
                    assignedLabelIds.add(labelPolygon.labelId);
                }
            });

        imageData.labelLines
            .filter((labelLine: LabelLine) => !!labelLine.labelId)
            .forEach((labelLine: LabelLine) => {
                if (labelLine.labelId) {
                    assignedLabelIds.add(labelLine.labelId);
                }
            });

        return assignedLabelIds;
    }

    private static getImageAssignedClassLabelIds(imageData: ImageData): Set<string> {
        const assignedLabelIds = new Set<string>(imageData.labelNameIds || []);

        imageData.labelRects
            .filter(
                (labelRect: LabelRect) =>
                    labelRect.status === LabelStatus.ACCEPTED && !!labelRect.labelId
            )
            .forEach((labelRect: LabelRect) => {
                if (labelRect.labelId) {
                    assignedLabelIds.add(labelRect.labelId);
                }
            });

        imageData.labelPoints
            .filter(
                (labelPoint: LabelPoint) =>
                    labelPoint.status === LabelStatus.ACCEPTED && !!labelPoint.labelId
            )
            .forEach((labelPoint: LabelPoint) => {
                if (labelPoint.labelId) {
                    assignedLabelIds.add(labelPoint.labelId);
                }
            });

        imageData.labelPolygons
            .filter((labelPolygon: LabelPolygon) => !!labelPolygon.labelId)
            .forEach((labelPolygon: LabelPolygon) => {
                if (labelPolygon.labelId) {
                    assignedLabelIds.add(labelPolygon.labelId);
                }
            });

        imageData.labelLines
            .filter((labelLine: LabelLine) => !!labelLine.labelId)
            .forEach((labelLine: LabelLine) => {
                if (labelLine.labelId) {
                    assignedLabelIds.add(labelLine.labelId);
                }
            });

        return assignedLabelIds;
    }

    private static isLegacyCriteria(
        criteria: ImageClassCriteria
    ): criteria is LegacyImageClassCriteria {
        const candidate = criteria as LegacyImageClassCriteria;
        return (
            !!candidate &&
            typeof candidate === "object" &&
            typeof candidate.labelId === "string" &&
            (candidate.mode === "include" || candidate.mode === "exclude") &&
            (candidate.operator === "and" || candidate.operator === "or")
        );
    }

    private static isExpressionCriteria(
        criteria: ImageClassCriteria
    ): criteria is ImageClassExpressionCriteria {
        const candidate = criteria as ImageClassExpressionCriteria;
        return (
            !!candidate &&
            typeof candidate === "object" &&
            (candidate.type === "label" ||
                candidate.type === "otherLabels" ||
                candidate.type === "operator" ||
                candidate.type === "parenthesis")
        );
    }

    private static convertLegacyCriteria(
        legacyCriteria: LegacyImageClassCriteria[]
    ): ImageClassExpressionCriteria[] {
        if (!legacyCriteria.length) {
            return [];
        }

        let expression: ImageClassExpressionCriteria[] = [];

        legacyCriteria.forEach((criteria: LegacyImageClassCriteria, index: number) => {
            const criterionTokens: ImageClassExpressionCriteria[] =
                criteria.mode === "exclude"
                    ? [
                        {
                            type: "operator",
                            operator: "NOT",
                        },
                        {
                            type: "label",
                            labelId: criteria.labelId,
                        },
                    ]
                    : [
                        {
                            type: "label",
                            labelId: criteria.labelId,
                        },
                    ];

            if (index === 0) {
                expression = criterionTokens;
                return;
            }

            expression = [
                {
                    type: "parenthesis",
                    value: "(",
                },
                ...expression,
                {
                    type: "operator",
                    operator: criteria.operator === "or" ? "OR" : "AND",
                },
                ...criterionTokens,
                {
                    type: "parenthesis",
                    value: ")",
                },
            ];
        });

        return expression;
    }

    public static normalizeImageClassCriteria(
        classCriteria: ImageClassCriteria[] = []
    ): ImageClassExpressionCriteria[] {
        if (!classCriteria.length) {
            return [];
        }

        const expressionCriteria = classCriteria
            .filter((criteria: ImageClassCriteria): criteria is ImageClassExpressionCriteria =>
                ImageFilterUtil.isExpressionCriteria(criteria)
            )
            .map((criteria: ImageClassExpressionCriteria): ImageClassExpressionCriteria => {
                if (criteria.type === "label") {
                    return {
                        type: "label",
                        labelId: criteria.labelId,
                    };
                }

                if (criteria.type === "otherLabels") {
                    return {
                        type: "otherLabels",
                    };
                }

                if (criteria.type === "operator") {
                    return {
                        type: "operator",
                        operator: criteria.operator,
                    };
                }

                return {
                    type: "parenthesis",
                    value: criteria.value,
                };
            });

        if (expressionCriteria.length > 0) {
            return expressionCriteria;
        }

        const legacyCriteria = classCriteria.filter((criteria: ImageClassCriteria) =>
            ImageFilterUtil.isLegacyCriteria(criteria)
        ) as LegacyImageClassCriteria[];

        return ImageFilterUtil.convertLegacyCriteria(legacyCriteria);
    }

    private static parseImageClassCriteria(
        criteriaTokens: ImageClassExpressionCriteria[]
    ): CriteriaAstNode | null {
        let index = 0;

        const peek = (): ImageClassExpressionCriteria | null =>
            index < criteriaTokens.length ? criteriaTokens[index] : null;

        const consume = (): ImageClassExpressionCriteria | null => {
            const token = peek();
            if (token) {
                index += 1;
            }
            return token;
        };

        const matchOperator = (operator: ImageClassBooleanOperator): boolean => {
            const token = peek();
            if (token?.type === "operator" && token.operator === operator) {
                index += 1;
                return true;
            }
            return false;
        };

        const parseExpression = (): CriteriaAstNode | null => parseOr();

        const parseOr = (): CriteriaAstNode | null => {
            let left = parseAnd();
            if (!left) {
                return null;
            }

            while (matchOperator("OR")) {
                const right = parseAnd();
                if (!right) {
                    return null;
                }

                left = {
                    type: "or",
                    left,
                    right,
                };
            }

            return left;
        };

        const parseAnd = (): CriteriaAstNode | null => {
            let left = parseUnary();
            if (!left) {
                return null;
            }

            while (matchOperator("AND")) {
                const right = parseUnary();
                if (!right) {
                    return null;
                }

                left = {
                    type: "and",
                    left,
                    right,
                };
            }

            return left;
        };

        const parseUnary = (): CriteriaAstNode | null => {
            if (matchOperator("NOT")) {
                const child = parseUnary();
                if (!child) {
                    return null;
                }

                return {
                    type: "not",
                    child,
                };
            }

            return parsePrimary();
        };

        const parsePrimary = (): CriteriaAstNode | null => {
            const token = consume();
            if (!token) {
                return null;
            }

            if (token.type === "label") {
                return {
                    type: "label",
                    labelId: token.labelId,
                };
            }

            if (token.type === "otherLabels") {
                return {
                    type: "otherLabels",
                };
            }

            if (token.type === "parenthesis" && token.value === "(") {
                const node = parseExpression();
                if (!node) {
                    return null;
                }

                const closing = consume();
                if (
                    !closing ||
                    closing.type !== "parenthesis" ||
                    closing.value !== ")"
                ) {
                    return null;
                }

                return node;
            }

            return null;
        };

        const rootNode = parseExpression();
        if (!rootNode || index !== criteriaTokens.length) {
            return null;
        }

        return rootNode;
    }

    private static getReferencedClassLabelIds(
        criteriaTokens: ImageClassExpressionCriteria[]
    ): Set<string> {
        const labelIds = new Set<string>();
        criteriaTokens.forEach((criteria: ImageClassExpressionCriteria) => {
            if (
                criteria.type === "label" &&
                !ImageGroupUtil.isGroupFilterTokenId(criteria.labelId)
            ) {
                labelIds.add(criteria.labelId);
            }
        });
        return labelIds;
    }

    public static isImageClassCriteriaValid(
        classCriteria: ImageClassCriteria[] = []
    ): boolean {
        const normalizedCriteria = ImageFilterUtil.normalizeImageClassCriteria(classCriteria);
        if (!normalizedCriteria.length) {
            return true;
        }

        return !!ImageFilterUtil.parseImageClassCriteria(normalizedCriteria);
    }

    private static evaluateImageClassCriteria(
        node: CriteriaAstNode,
        assignedLabelIds: Set<string>,
        assignedClassLabelIds: Set<string>,
        referencedClassLabelIds: Set<string>
    ): boolean {
        switch (node.type) {
            case "label":
                return assignedLabelIds.has(node.labelId);
            case "otherLabels":
                return Array.from(assignedClassLabelIds).some(
                    (labelId: string) => !referencedClassLabelIds.has(labelId)
                );
            case "not":
                return !ImageFilterUtil.evaluateImageClassCriteria(
                    node.child,
                    assignedLabelIds,
                    assignedClassLabelIds,
                    referencedClassLabelIds
                );
            case "and":
                return (
                    ImageFilterUtil.evaluateImageClassCriteria(
                        node.left,
                        assignedLabelIds,
                        assignedClassLabelIds,
                        referencedClassLabelIds
                    ) &&
                    ImageFilterUtil.evaluateImageClassCriteria(
                        node.right,
                        assignedLabelIds,
                        assignedClassLabelIds,
                        referencedClassLabelIds
                    )
                );
            case "or":
                return (
                    ImageFilterUtil.evaluateImageClassCriteria(
                        node.left,
                        assignedLabelIds,
                        assignedClassLabelIds,
                        referencedClassLabelIds
                    ) ||
                    ImageFilterUtil.evaluateImageClassCriteria(
                        node.right,
                        assignedLabelIds,
                        assignedClassLabelIds,
                        referencedClassLabelIds
                    )
                );
            default:
                return true;
        }
    }

    public static getFilteredImageIndices(
        imagesData: ImageData[],
        labelType: LabelType,
        filterMode: ImageFilterMode,
        searchText: string,
        classCriteria: ImageClassCriteria[] = [],
        keepLabeledInUnlabeled: boolean = false,
        keptUnlabeledImageIds: string[] = []
    ): number[] {
        const normalizedSearchText = (searchText || "").toLowerCase();
        const normalizedCriteria = ImageFilterUtil.normalizeImageClassCriteria(classCriteria);
        const criteriaAst = normalizedCriteria.length > 0
            ? ImageFilterUtil.parseImageClassCriteria(normalizedCriteria)
            : null;
        const referencedClassLabelIds = ImageFilterUtil.getReferencedClassLabelIds(normalizedCriteria);
        const hasValidCriteria = normalizedCriteria.length === 0 || !!criteriaAst;
        const keptUnlabeledImageIdSet = new Set<string>(keptUnlabeledImageIds);

        return imagesData
            .map((image, index) => ({ image, index }))
            .filter(({ image, index }) => {
                const filename = image.fileData?.name || "";
                const matchesSearch =
                    normalizedSearchText.length === 0 ||
                    filename.toLowerCase().includes(normalizedSearchText);

                let matchesFilter = true;
                if (filterMode === ImageFilterMode.LABELED) {
                    matchesFilter = ImageFilterUtil.isImageLabeled(image, labelType);
                } else if (filterMode === ImageFilterMode.UNLABELED) {
                    matchesFilter = keepLabeledInUnlabeled
                        ? keptUnlabeledImageIdSet.has(image.id)
                        : !ImageFilterUtil.isImageLabeled(image, labelType);
                }

                const assignedLabelIds = ImageFilterUtil.getImageAssignedLabelIds(image);
                const assignedClassLabelIds = ImageFilterUtil.getImageAssignedClassLabelIds(image);

                let criteriaResult = true;
                if (criteriaAst && hasValidCriteria) {
                    criteriaResult = ImageFilterUtil.evaluateImageClassCriteria(
                        criteriaAst,
                        assignedLabelIds,
                        assignedClassLabelIds,
                        referencedClassLabelIds
                    );
                }

                return matchesSearch && matchesFilter && criteriaResult;
            })
            .map(({ index }) => index);
    }
}
