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
    const [asymRatio_B, asymRatio_E] = keypointUtilsInstance.getRatioFromKeypointPolygons()



    return (
        <div className={getClassName()}>
            <ImageButton
                image={"ico/left.png"}
                imageAlt={"previous"}
                buttonSize={{ width: 25, height: 25 }}
                onClick={() => ImageActions.getPreviousImage()}
                isDisabled={activeImageIndex === 0}
                externalClassName={"left"}
            />
            {size.width > minWidth ?
                <div className="CurrentImageName"> {imageData.fileData.name} </div> :
                <div className="CurrentImageCount"> {getImageCounter()} </div>
            }
            <ImageButton
                image={"ico/right.png"}
                imageAlt={"next"}
                buttonSize={{ width: 25, height: 25 }}
                onClick={() => ImageActions.getNextImage()}
                isDisabled={activeImageIndex === totalImageCount - 1}
                externalClassName={"right"}
            />
            <div className="RatioMeasurement"> B-Asym ratio = {asymRatio_B?.toFixed(2) ?? 'null'}, E-Asym ratio = {asymRatio_E?.toFixed(2) ?? 'null'} </div>
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
