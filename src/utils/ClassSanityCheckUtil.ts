import { ClassSanityCheckSettings } from "../store/general/types";
import { ImageData, LabelName } from "../store/labels/types";

export type ClassSanityCheckViolation = {
  imageId: string;
  imageName: string;
  classViolations: {
    labelName: string;
    actualCount: number;
    allowedCounts: number[];
  }[];
};

export const CLASS_SANITY_CHECK_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5];

const DEFAULT_ALLOWED_COUNTS = [0, 1];

export class ClassSanityCheckUtil {
  public static getAllowedCountsForLabel(
    settings: ClassSanityCheckSettings,
    labelName: string
  ): number[] {
    const rule = settings.rules.find(
      (entry) => entry.labelName === labelName && entry.allowedCounts.length > 0
    );

    return rule ? rule.allowedCounts : DEFAULT_ALLOWED_COUNTS;
  }

  public static sanitizeAllowedCounts(value: string): number[] {
    return ClassSanityCheckUtil.sanitizeAllowedCountValues(
      value.split(",").map((entry) => Number(entry.trim()))
    );
  }

  public static sanitizeAllowedCountValues(values: number[]): number[] {
    return Array.from(
      new Set(
        values.filter((entry) =>
          CLASS_SANITY_CHECK_COUNT_OPTIONS.includes(entry)
        )
      )
    ).sort((first, second) => first - second);
  }

  public static formatAllowedCounts(allowedCounts: number[]): string {
    return allowedCounts.join(", ");
  }

  public static getImageViolation(
    imageData: ImageData,
    labels: LabelName[],
    settings: ClassSanityCheckSettings
  ): ClassSanityCheckViolation | null {
    if (!settings.enabled || !imageData) {
      return null;
    }

    const labelNameById = new Map<string, string>();
    labels.forEach((label) => labelNameById.set(label.id, label.name));

    const countsByLabelName = new Map<string, number>();
    labels.forEach((label) => countsByLabelName.set(label.name, 0));

    const incrementByLabelId = (labelId: string | null) => {
      if (!labelId) {
        return;
      }

      const labelName = labelNameById.get(labelId);
      if (!labelName) {
        return;
      }

      countsByLabelName.set(labelName, (countsByLabelName.get(labelName) || 0) + 1);
    };

    imageData.labelRects.forEach((label) => incrementByLabelId(label.labelId));
    imageData.labelPoints.forEach((label) => incrementByLabelId(label.labelId));
    imageData.labelLines.forEach((label) => incrementByLabelId(label.labelId));
    imageData.labelPolygons.forEach((label) => incrementByLabelId(label.labelId));
    imageData.labelNameIds.forEach((labelId) => incrementByLabelId(labelId));

    const classViolations = labels
      .map((label) => {
        const allowedCounts = ClassSanityCheckUtil.getAllowedCountsForLabel(
          settings,
          label.name
        );
        const actualCount = countsByLabelName.get(label.name) || 0;

        return {
          labelName: label.name,
          actualCount,
          allowedCounts,
        };
      })
      .filter((violation) => !violation.allowedCounts.includes(violation.actualCount));

    if (classViolations.length === 0) {
      return null;
    }

    return {
      imageId: imageData.id,
      imageName: imageData.fileData?.name || "Untitled image",
      classViolations,
    };
  }

  public static getImageViolations(
    imagesData: ImageData[],
    labels: LabelName[],
    settings: ClassSanityCheckSettings
  ): ClassSanityCheckViolation[] {
    if (!settings.enabled) {
      return [];
    }

    return imagesData
      .map((imageData) =>
        ClassSanityCheckUtil.getImageViolation(imageData, labels, settings)
      )
      .filter((violation): violation is ClassSanityCheckViolation => !!violation);
  }

  public static upsertViolationImageId(
    violationImageIds: string[],
    imageId: string,
    hasViolation: boolean
  ): string[] {
    if (!hasViolation) {
      return violationImageIds.filter((id) => id !== imageId);
    }

    return violationImageIds.includes(imageId)
      ? violationImageIds
      : [...violationImageIds, imageId];
  }
}
