import React, { useMemo, useState } from "react";
import { connect } from "react-redux";
import { AppState } from "../../../store";
import { GenericYesNoPopup } from "../GenericYesNoPopup/GenericYesNoPopup";
import { ImageData, LabelName } from "../../../store/labels/types";
import { ClassSanityCheckSettings } from "../../../store/general/types";
import {
  updateActivePopupType,
  updateClassSanityCheckSettings,
  updateClassSanityCheckViolationImageIds,
  updateClassSanityCheckReviewMode,
} from "../../../store/general/actionCreators";
import { PopupWindowType } from "../../../data/enums/PopupWindowType";
import { BrowserSettingsStorage } from "../../../utils/BrowserSettingsStorage";
import { ImageActions } from "../../../logic/actions/ImageActions";
import { CLASS_SANITY_CHECK_COUNT_OPTIONS, ClassSanityCheckUtil } from "../../../utils/ClassSanityCheckUtil";
import "./ClassSanityCheckPopup.scss";

interface IProps {
  labels: LabelName[];
  imagesData: ImageData[];
  settings: ClassSanityCheckSettings;
  classSanityCheckReviewMode: boolean;
  updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
  updateClassSanityCheckSettingsAction: (
    settings: ClassSanityCheckSettings
  ) => any;
  updateClassSanityCheckViolationImageIdsAction: (imageIds: string[]) => any;
  updateClassSanityCheckReviewModeAction: (reviewMode: boolean) => any;
}

type RuleDraft = Record<string, number[]>;

const getUniqueLabelNames = (labels: LabelName[]): string[] =>
  Array.from(new Set(labels.map((label) => label.name))).sort((first, second) =>
    first.localeCompare(second)
  );

const createRuleDraft = (
  labels: LabelName[],
  settings: ClassSanityCheckSettings
): RuleDraft => {
  const draft: RuleDraft = {};
  getUniqueLabelNames(labels).forEach((labelName) => {
    draft[labelName] = ClassSanityCheckUtil.getAllowedCountsForLabel(
      settings,
      labelName
    );
  });
  return draft;
};

const ClassSanityCheckPopup: React.FC<IProps> = ({
  labels,
  imagesData,
  settings,
  classSanityCheckReviewMode,
  updateActivePopupTypeAction,
  updateClassSanityCheckSettingsAction,
  updateClassSanityCheckViolationImageIdsAction,
  updateClassSanityCheckReviewModeAction,
}) => {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(() =>
    createRuleDraft(labels, settings)
  );

  const labelNames = useMemo(() => getUniqueLabelNames(labels), [labels]);

  const draftSettings = useMemo<ClassSanityCheckSettings>(() => {
    return {
      enabled,
      simultaneous: false,
      rules: labelNames
        .map((labelName) => ({
          labelName,
          allowedCounts: ClassSanityCheckUtil.sanitizeAllowedCountValues(
            ruleDraft[labelName] || []
          ),
        }))
        .filter((rule) => rule.allowedCounts.length > 0),
    };
  }, [enabled, labelNames, ruleDraft]);

  const invalidLabelNames = useMemo(
    () =>
      labelNames.filter(
        (labelName) =>
          ClassSanityCheckUtil.sanitizeAllowedCountValues(
            ruleDraft[labelName] || []
          ).length === 0
      ),
    [labelNames, ruleDraft]
  );

  const violations = useMemo(
    () =>
      ClassSanityCheckUtil.getImageViolations(
        imagesData,
        labels,
        draftSettings
      ),
    [imagesData, labels, draftSettings]
  );

  const toggleAllowedCount = (labelName: string, count: number) => {
    setRuleDraft((previousDraft) => {
      const currentCounts = previousDraft[labelName] || [];
      const nextCounts = currentCounts.includes(count)
        ? currentCounts.filter((currentCount) => currentCount !== count)
        : [...currentCounts, count];

      return {
        ...previousDraft,
        [labelName]: ClassSanityCheckUtil.sanitizeAllowedCountValues(nextCounts),
      };
    });
  };

  const onAccept = () => {
    if (invalidLabelNames.length > 0) {
      return;
    }

    BrowserSettingsStorage.saveClassSanityCheckSettings(draftSettings);
    updateClassSanityCheckSettingsAction(draftSettings);
    updateClassSanityCheckViolationImageIdsAction(
      draftSettings.enabled ? violations.map((violation) => violation.imageId) : []
    );
    updateClassSanityCheckReviewModeAction(false);
    updateActivePopupTypeAction(null);
  };

  const onReview = () => {
    if (invalidLabelNames.length > 0 || violations.length === 0) {
      return;
    }

    BrowserSettingsStorage.saveClassSanityCheckSettings(draftSettings);
    updateClassSanityCheckSettingsAction(draftSettings);
    updateClassSanityCheckViolationImageIdsAction(
      violations.map((violation) => violation.imageId)
    );
    updateClassSanityCheckReviewModeAction(true);

    const firstViolationImageIndex = imagesData.findIndex(
      (imageData) => imageData.id === violations[0].imageId
    );
    if (firstViolationImageIndex !== -1) {
      ImageActions.getImageByIndex(firstViolationImageIndex);
    }

    updateActivePopupTypeAction(null);
  };

  const onCancelReview = () => {
    updateClassSanityCheckReviewModeAction(false);
    updateActivePopupTypeAction(null);
  };

  const shouldShowReviewAction = violations.length > 0 && invalidLabelNames.length === 0;

  const onReject = () => {
    updateActivePopupTypeAction(null);
  };

  const renderRuleRows = () => {
    if (labelNames.length === 0) {
      return <div className="EmptyState">No classes found yet.</div>;
    }

    return labelNames.map((labelName) => {
      const sanitizedCounts = ClassSanityCheckUtil.sanitizeAllowedCountValues(
        ruleDraft[labelName] || []
      );
      const isInvalid = sanitizedCounts.length === 0;

      return (
        <div key={labelName} className={`RuleRow ${isInvalid ? "invalid" : ""}`}>
          <div className="ClassName" title={labelName}>{labelName}</div>
          <div className="CountOptions" aria-label={`${labelName} allowed times`}>
            {CLASS_SANITY_CHECK_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                className={`CountOption ${sanitizedCounts.includes(count) ? "selected" : ""}`}
                type="button"
                onClick={() => toggleAllowedCount(labelName, count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      );
    });
  };

  const renderContent = () => (
    <div className="ClassSanityCheckPopup">
      <div className="SettingsPanel">
        <button
          className={`SwitchRow ${enabled ? "active" : ""}`}
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
        >
          <span className="SwitchControl" />
          <span className="SwitchText">Enable class sanity check</span>
        </button>
      </div>

      <div className={`SummaryBar ${violations.length > 0 ? "hasViolations" : ""}`}>
        <span className="Counter">
          <span className="CounterValue">{violations.length}</span>
          <span className="CounterSeparator"> / </span>
          <span className="CounterValue">{imagesData.length}</span>
          <span> images violate current rules</span>
        </span>
      </div>

      <div className="RulesTable">
        <div className="RulesHeader">
          <span>Class</span>
          <span>Allowed times per image</span>
        </div>
        <div className="RulesBody">{renderRuleRows()}</div>
      </div>
    </div>
  );

  return (
    <GenericYesNoPopup
      title="Class Sanity Check"
      renderContent={renderContent}
      acceptLabel="Save"
      onAccept={onAccept}
      rejectLabel="Cancel"
      onReject={onReject}
      disableAcceptButton={invalidLabelNames.length > 0}
      disabledTooltip="Every class must have at least one selected count."
      popupClassName="ClassSanityCheckPopupDialog"
      extraActionLabel={shouldShowReviewAction ? (classSanityCheckReviewMode ? "Cancel Review" : "Review") : undefined}
      onExtraAction={shouldShowReviewAction ? (classSanityCheckReviewMode ? onCancelReview : onReview) : undefined}
      extraActionButtonClassName="danger"
    />
  );
};

const mapStateToProps = (state: AppState) => ({
  labels: state.labels.labels,
  imagesData: state.labels.imagesData,
  settings: state.general.classSanityCheckSettings,
  classSanityCheckReviewMode: state.general.classSanityCheckReviewMode,
});

const mapDispatchToProps = {
  updateActivePopupTypeAction: updateActivePopupType,
  updateClassSanityCheckSettingsAction: updateClassSanityCheckSettings,
  updateClassSanityCheckViolationImageIdsAction: updateClassSanityCheckViolationImageIds,
  updateClassSanityCheckReviewModeAction: updateClassSanityCheckReviewMode,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ClassSanityCheckPopup);
