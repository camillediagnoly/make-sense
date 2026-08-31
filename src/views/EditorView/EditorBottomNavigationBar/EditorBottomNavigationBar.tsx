import React from 'react';
import './EditorBottomNavigationBar.scss';
import { ImageData } from "../../../store/labels/types";
import { AppState } from "../../../store";
import { connect } from "react-redux";
import { ImageButton } from "../../Common/ImageButton/ImageButton";
import { ISize } from "../../../interfaces/ISize";
import { ContextType } from "../../../data/enums/ContextType";
import classNames from "classnames";
import { ImageActions } from "../../../logic/actions/ImageActions";
import { KeypointUtils, MeasurementResult } from "../../../logic/render/PolygonRenderEngine";
import { ImageFilterMode } from "../../../data/enums/ImageFilterMode";
import { ImageSortMode } from "../../../data/enums/ImageSortMode";
import { ImageFilterUtil } from "../../../utils/ImageFilterUtil";
import { LabelType } from "../../../data/enums/LabelType";
import { ImageClassCriteria } from "../../../store/general/types";

interface IProps {
    size: ISize;
    imageData: ImageData;
    imagesData: ImageData[];
    activeImageIndex: number | null;
    activeContext: ContextType;
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    sortMode: ImageSortMode;
    sortOrderLocked: boolean;
    lockedImageSortOrderIds: string[];
    keepLabeledInUnlabeled: boolean;
    keptUnlabeledImageIds: string[];
    imageClassCriteria: ImageClassCriteria[];
}

const EditorBottomNavigationBar: React.FC<IProps> = ({
    imageData,
    imagesData,
    activeImageIndex,
    activeContext,
    activeLabelType,
    filterMode,
    searchText,
    sortMode,
    sortOrderLocked,
    lockedImageSortOrderIds,
    keepLabeledInUnlabeled,
    keptUnlabeledImageIds,
    imageClassCriteria
}) => {
    const filteredIndices = ImageFilterUtil.getFilteredImageIndices(
        imagesData,
        activeLabelType,
        filterMode,
        searchText,
        imageClassCriteria,
        keepLabeledInUnlabeled,
        keptUnlabeledImageIds,
        sortMode,
        sortOrderLocked ? lockedImageSortOrderIds : []
    );
    const activeFilteredIndex = activeImageIndex === null
        ? -1
        : filteredIndices.indexOf(activeImageIndex);
    const totalImageCount = filteredIndices.length;
    const currentImagePosition = activeFilteredIndex >= 0 ? activeFilteredIndex + 1 : 0;

    type CompletedMeasurementResult = MeasurementResult & { value: number };

    const isCompletedMeasurementResult = (
        measurementResult: MeasurementResult,
    ): measurementResult is CompletedMeasurementResult => {
        return measurementResult.value !== null;
    };

    const getImageCounter = () => {
        return currentImagePosition + " / " + totalImageCount;
    };

    const getClassName = () => {
        return classNames(
            "EditorBottomNavigationBar",
            {
                "with-context": activeContext === ContextType.EDITOR
            }
        );
    };

    const formatMeasurementResult = (
        measurementResult: CompletedMeasurementResult,
    ): string => {
        const formattedValue = measurementResult.unit === 'degree'
            ? `${measurementResult.value.toFixed(3)}°`
            : measurementResult.value.toFixed(3);

        return `${measurementResult.displayName} = ${formattedValue}`;
    };

    const completedMeasurementTexts = new KeypointUtils()
        .buildMeasurementResults()
        .filter(isCompletedMeasurementResult)
        .map(formatMeasurementResult);

    return (
        <div className={getClassName()}>
            <div className="TopRow">
                <ImageButton
                    image={"ico/left.png"}
                    imageAlt={"previous"}
                    buttonSize={{ width: 25, height: 25 }}
                    onClick={() => ImageActions.getPreviousImage()}
                    isDisabled={totalImageCount === 0 || (activeFilteredIndex >= 0 && activeFilteredIndex === 0)}
                    externalClassName={"left"}
                />

                    <div className="CurrentImageName"> {imageData.fileData.name} </div> :
                    <div className="CurrentImageCount"> {getImageCounter()} </div>

                <ImageButton
                    image={"ico/right.png"}
                    imageAlt={"next"}
                    buttonSize={{ width: 25, height: 25 }}
                    onClick={() => ImageActions.getNextImage()}
                    isDisabled={
                        totalImageCount === 0 ||
                        (activeFilteredIndex >= 0 && activeFilteredIndex === totalImageCount - 1)
                    }
                    externalClassName={"right"}
                />
            </div>
            <div className="BottomRow">
                {completedMeasurementTexts.map((measurementText) => (
                    <div className="RatioMeasurement" key={measurementText}>
                        {measurementText}
                    </div>
                ))}
            </div>
        </div>
    );
};

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    activeContext: state.general.activeContext,
    imagesData: state.labels.imagesData,
    activeLabelType: state.labels.activeLabelType,
    filterMode: state.general.imageListFilterMode,
    searchText: state.general.imageListSearchText,
    sortMode: state.general.imageListSortMode,
    sortOrderLocked: state.general.imageListSortOrderLocked,
    lockedImageSortOrderIds: state.general.lockedImageSortOrderIds,
    keepLabeledInUnlabeled: state.general.keepLabeledInUnlabeled,
    keptUnlabeledImageIds: state.general.keptUnlabeledImageIds,
    imageClassCriteria: state.general.imageClassCriteria
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorBottomNavigationBar);
