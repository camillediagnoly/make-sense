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
import { KeypointUtils } from "../../../logic/render/PolygonRenderEngine";
import { ImageFilterMode } from "../../../data/enums/ImageFilterMode";
import { ImageFilterUtil } from "../../../utils/ImageFilterUtil";
import { LabelType } from "../../../data/enums/LabelType";
import { ImageClassCriteria } from "../../../store/general/types";

interface IProps {
    size: ISize;
    imageData: ImageData;
    imagesData: ImageData[];
    activeImageIndex: number;
    activeContext: ContextType;
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    keepLabeledInUnlabeled: boolean;
    keptUnlabeledImageIds: string[];
    imageClassCriteria: ImageClassCriteria[];
}

const EditorBottomNavigationBar: React.FC<IProps> = ({
    size,
    imageData,
    imagesData,
    activeImageIndex,
    activeContext,
    activeLabelType,
    filterMode,
    searchText,
    keepLabeledInUnlabeled,
    keptUnlabeledImageIds,
    imageClassCriteria
}) => {
    const minWidth: number = 400;

    const filteredIndices = ImageFilterUtil.getFilteredImageIndices(
        imagesData,
        activeLabelType,
        filterMode,
        searchText,
        imageClassCriteria,
        keepLabeledInUnlabeled,
        keptUnlabeledImageIds
    );
    const activeFilteredIndex = filteredIndices.indexOf(activeImageIndex);
    const totalImageCount = filteredIndices.length;
    const currentImagePosition = activeFilteredIndex >= 0 ? activeFilteredIndex + 1 : 0;

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
    const keypointUtilsInstance = new KeypointUtils();
    const [asymRatio_B, angle_B, areaRatio_B, positionRatio_B, veinsRatio_B, avRatio_B,
        tgaRatio_D, asymRatio_E, tgaRatio_E, asymRatioCSP_F, 
        asymRatioCI_F, angleSF_F, ratioSF_F, ratioAtrVMG_F, ratio4V_G] = keypointUtilsInstance.buildMeasurements()



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
                <div className="RatioMeasurement">
                    <div className="RatioMeasurement">
                        B-Asym = {asymRatio_B?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        B-Area = {areaRatio_B?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        B-Position = {positionRatio_B?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        B-Veins = {veinsRatio_B?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        B-AVL = {avRatio_B?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        B-Angle = {angle_B != null ? `${angle_B.toFixed(3)}°` : 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        D-TGA = {tgaRatio_D?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        E-Asym = {asymRatio_E?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        E-TGA = {tgaRatio_E?.toFixed(3) ?? 'null'}
                    </div>
                </div>
                <div className="RatioMeasurement">
                    <div className="RatioMeasurement">
                        F-Asym-CSP = {asymRatioCSP_F?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        F-Asym-CI = {asymRatioCI_F?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        F-RatioSF = {ratioSF_F?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        F-AngleSF = {angleSF_F != null ? `${angleSF_F.toFixed(3)}°` : 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        F-Vp = {ratioAtrVMG_F?.toFixed(3) ?? 'null'}
                    </div>
                    <div className="RatioMeasurement">
                        G-4V = {ratio4V_G?.toFixed(3) ?? 'null'}
                    </div>
                </div>
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
    keepLabeledInUnlabeled: state.general.keepLabeledInUnlabeled,
    keptUnlabeledImageIds: state.general.keptUnlabeledImageIds,
    imageClassCriteria: state.general.imageClassCriteria
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorBottomNavigationBar);
