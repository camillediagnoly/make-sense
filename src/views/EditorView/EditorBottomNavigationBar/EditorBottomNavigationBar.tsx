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

interface IProps {
    size: ISize;
    imageData: ImageData;
    totalImageCount: number;
    activeImageIndex: number;
    activeContext: ContextType;
}

const EditorBottomNavigationBar: React.FC<IProps> = ({ size, imageData, totalImageCount, activeImageIndex, activeContext }) => {
    const minWidth: number = 400;

    const getImageCounter = () => {
        return (activeImageIndex + 1) + " / " + totalImageCount;
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
    const [asymRatio_B, angle_B, areaRatio_B, positionRatio_B, veinsRatio_B,
        tgaRatio_D, asymRatio_E, tgaRatio_E, asymRatioCSP_F,
        asymRatioCI_F, angleSF_F, ratioSF_F, ratioAtrVMG_F] = keypointUtilsInstance.buildMeasurements()



    return (
        <div className={getClassName()}>
            <div className="TopRow">
                <ImageButton
                    image={"ico/left.png"}
                    imageAlt={"previous"}
                    buttonSize={{ width: 25, height: 25 }}
                    onClick={() => ImageActions.getPreviousImage()}
                    isDisabled={activeImageIndex === 0}
                    externalClassName={"left"}
                />

                    <div className="CurrentImageName"> {imageData.fileData.name} </div> :
                    <div className="CurrentImageCount"> {getImageCounter()} </div>

                <ImageButton
                    image={"ico/right.png"}
                    imageAlt={"next"}
                    buttonSize={{ width: 25, height: 25 }}
                    onClick={() => ImageActions.getNextImage()}
                    isDisabled={activeImageIndex === totalImageCount - 1}
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
                        F-AtrVMG = {ratioAtrVMG_F?.toFixed(3) ?? 'null'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    activeContext: state.general.activeContext
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorBottomNavigationBar);
