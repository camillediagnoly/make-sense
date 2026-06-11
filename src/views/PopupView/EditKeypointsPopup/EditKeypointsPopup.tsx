import React, { useEffect, useState } from "react";
import { connect } from "react-redux";
import { GenericYesNoPopup } from "../GenericYesNoPopup/GenericYesNoPopup";
import { AppState } from "../../../store";
import { LabelName } from "../../../store/labels/types";
import { updateMeasurementFunctions } from "../../../store/general/actionCreators";
import { PopupActions } from "../../../logic/actions/PopupActions";
import {
    MEASUREMENT_FUNCTIONS,
    MeasurementFunctionByName,
    MeasurementFunctionId,
    inferMeasurementDefinitions,
} from "../../../data/measurements/MeasurementFunctionData";
import { MeasurementFunctionDiagram } from "./MeasurementFunctionDiagram";
import "./EditKeypointsPopup.scss";

interface IProps {
    labelNames: LabelName[];
    measurementFunctionByName: MeasurementFunctionByName;
    updateMeasurementFunctionsAction: (
        measurementFunctionByName: MeasurementFunctionByName
    ) => any;
}

const EditKeypointsPopup: React.FC<IProps> = ({
    labelNames,
    measurementFunctionByName,
    updateMeasurementFunctionsAction,
}) => {
    const [localMeasurementFunctions, setLocalMeasurementFunctions] =
        useState<MeasurementFunctionByName>({});

    useEffect(() => {
        setLocalMeasurementFunctions({ ...measurementFunctionByName });
    }, [measurementFunctionByName]);

    const measurementDefinitions = inferMeasurementDefinitions(
        labelNames,
        localMeasurementFunctions
    );

    const onFunctionChange = (
        measurementName: string,
        functionId: MeasurementFunctionId | null
    ) => {
        setLocalMeasurementFunctions((previous) => {
            const next = { ...previous };
            if (functionId) {
                next[measurementName] = functionId;
            } else {
                delete next[measurementName];
            }
            return next;
        });
    };

    const renderContent = () => {
        return (
            <div className="EditKeypointsPopupContent">
                <div className="FunctionGuide">
                    <div className="FunctionGuideHeader">
                        <div className="FunctionGuideTitle">Function guide</div>
                        <div className="FunctionGuideLegend">
                            <span className="LegendLine numerator" />
                            <span>Numerator</span>
                            <span className="LegendLine denominator" />
                            <span>Denominator</span>
                        </div>
                    </div>
                    <div className="FunctionGuideGrid">
                        {MEASUREMENT_FUNCTIONS.map((measurementFunction) => (
                            <div
                                className="FunctionGuideItem"
                                key={measurementFunction.id}
                            >
                                <MeasurementFunctionDiagram
                                    functionId={measurementFunction.id}
                                />
                                <div className="FunctionGuideName">
                                    {measurementFunction.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="KeypointsTableHeader">
                    <div className="MeasurementNameColumn">Measurement</div>
                    <div className="FunctionNameColumn">Function</div>
                </div>
                <div className="KeypointsTableBody">
                    {measurementDefinitions.map((measurementDefinition) => {
                        const selectedFunctionId =
                            measurementDefinition.functionId || "";

                        return (
                            <div
                                className="KeypointsTableRow"
                                key={measurementDefinition.measurementName}
                            >
                                <div className="MeasurementNameColumn">
                                    <div className="MeasurementDisplayName">
                                        {measurementDefinition.measurementName}
                                    </div>
                                    <div className="MeasurementPointCount">
                                        {
                                            measurementDefinition
                                                .keypointIndexes.length
                                        }{" "}
                                        keypoints
                                    </div>
                                </div>
                                <div className="FunctionNameColumn">
                                    <div className="FunctionSelection">
                                        <select
                                            value={selectedFunctionId}
                                            onChange={(event) =>
                                                onFunctionChange(
                                                    measurementDefinition.measurementName,
                                                    event.target.value
                                                        ? (event.target
                                                              .value as MeasurementFunctionId)
                                                        : null
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select function
                                            </option>
                                            {MEASUREMENT_FUNCTIONS.map(
                                                (measurementFunction) => (
                                                    <option
                                                        key={
                                                            measurementFunction.id
                                                        }
                                                        value={
                                                            measurementFunction.id
                                                        }
                                                    >
                                                        {
                                                            measurementFunction.name
                                                        }
                                                    </option>
                                                )
                                            )}
                                        </select>
                                        {measurementDefinition.functionId && (
                                            <MeasurementFunctionDiagram
                                                functionId={
                                                    measurementDefinition.functionId
                                                }
                                                compact
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const onAccept = () => {
        updateMeasurementFunctionsAction(localMeasurementFunctions);
        PopupActions.close();
    };

    return (
        <GenericYesNoPopup
            title="Edit Keypoints"
            renderContent={renderContent}
            acceptLabel="Save"
            onAccept={onAccept}
            rejectLabel="Cancel"
            onReject={PopupActions.close}
            popupClassName="EditKeypointsPopupDialog"
        />
    );
};

const mapDispatchToProps = {
    updateMeasurementFunctionsAction: updateMeasurementFunctions,
};

const mapStateToProps = (state: AppState) => ({
    labelNames: state.labels.labels,
    measurementFunctionByName: state.general.measurementFunctionByName,
});

export default connect(mapStateToProps, mapDispatchToProps)(EditKeypointsPopup);
