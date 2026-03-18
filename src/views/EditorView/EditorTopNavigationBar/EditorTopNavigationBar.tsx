import { ContextType } from '../../../data/enums/ContextType';
import './EditorTopNavigationBar.scss';
import React from 'react';
import classNames from 'classnames';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateCrossHairVisibleStatus, updateImageDragModeStatus, updateFixedZoomStatus, updateEllipseDrawStatus, updateMovingAnnotationStatus, updateCopyPolygonsStatus, updatePasteAnnotationsStatus, updatePolygonDrawMode, updateActivePopupType, updateLineKeypointMode } from '../../../store/general/actionCreators';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { ViewPointSettings } from '../../../settings/ViewPointSettings';
import { ImageButton } from '../../Common/ImageButton/ImageButton';
import { ViewPortActions } from '../../../logic/actions/ViewPortActions';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { LabelType } from '../../../data/enums/LabelType';
import { AISelector } from '../../../store/selectors/AISelector';
import { ISize } from '../../../interfaces/ISize';
import { AIActions } from '../../../logic/actions/AIActions';
import { Fade, styled, Tooltip, tooltipClasses, TooltipProps } from '@mui/material';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
const BUTTON_SIZE: ISize = { width: 30, height: 30 };
const BUTTON_PADDING: number = 10;

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#171717',
        color: '#ffffff',
        boxShadow: theme.shadows[1],
        fontSize: 12,
        maxWidth: 200,
        textAlign: 'center'
    },
}));

const getButtonWithTooltip = (
    key: string,
    tooltipMessage: string,
    imageSrc: string,
    imageAlt: string,
    isActive: boolean,
    href?: string,
    onClick?: () => any
): React.ReactElement => {
    return <StyledTooltip
        key={key}
        disableFocusListener={true}
        title={tooltipMessage}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 600 }}
        placement='bottom'
    >
        <div>
            <ImageButton
                buttonSize={BUTTON_SIZE}
                padding={BUTTON_PADDING}
                image={imageSrc}
                imageAlt={imageAlt}
                href={href}
                onClick={onClick}
                isActive={isActive}
            />
        </div>
    </StyledTooltip>;
};

interface IProps {
    activeContext: ContextType;
    updateImageDragModeStatusAction: (imageDragMode: boolean) => any;
    updateCrossHairVisibleStatusAction: (crossHairVisible: boolean) => any;
    updateFixedZoomStatusAction: (fixedZoom: boolean) => any;
    updateEllipseDrawAction: (ellipseDraw: boolean) => any;
    updateMovingAnnotationAction: (movingAnnotation: boolean) => any;
    updateCopyPolygonsAction: (copyPolygons: boolean) => any;
    updatePastePolygonsAction: (pastePolygons: boolean) => any;
    updatePolygonDrawModeAction: (polygonLassoMode: boolean) => any;
    updateLineKeypointModeAction: (lineKeypointMode: boolean) => any;
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    imageDragMode: boolean;
    crossHairVisible: boolean;
    fixedZoom: boolean;
    ellipseDraw: boolean;
    movingAnnotation: boolean;
    copyPolygons: boolean;
    pastePolygons: boolean;
    activeLabelType: LabelType;
    polygonLassoMode: boolean;
    lineKeypointMode: boolean;
}

const EditorTopNavigationBar: React.FC<IProps> = (
    {
        activeContext,
        updateImageDragModeStatusAction,
        updateCrossHairVisibleStatusAction,
        updateFixedZoomStatusAction,
        updateEllipseDrawAction,
        updateMovingAnnotationAction,
        updateCopyPolygonsAction,
        updatePastePolygonsAction,
        updatePolygonDrawModeAction,
        updateLineKeypointModeAction,
        updateActivePopupTypeAction,
        imageDragMode,
        crossHairVisible,
        fixedZoom,
        ellipseDraw,
        movingAnnotation,
        copyPolygons,
        pastePolygons,
        activeLabelType,
        polygonLassoMode,
        lineKeypointMode
    }) => {
    const getClassName = () => {
        return classNames(
            'EditorTopNavigationBar',
            {
                'with-context': activeContext === ContextType.EDITOR
            }
        );
    };

    const imageDragOnClick = () => {
        if (imageDragMode) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
        else if (GeneralSelector.getZoom() !== ViewPointSettings.MIN_ZOOM) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
    };

    const crossHairOnClick = () => {
        updateCrossHairVisibleStatusAction(!crossHairVisible);
    };

    const fixedZoomOnClick = () => {
        updateFixedZoomStatusAction(!fixedZoom);
    };

    const ellipseDrawOnClick = () => {
        updateEllipseDrawAction(!ellipseDraw);
    };

    const movingAnnotationOnClick = () => {
        updateMovingAnnotationAction(!movingAnnotation);
    };
    
    const copyPolygonsOnClick = () => {
        updateCopyPolygonsAction(!copyPolygons);
    };

    const pastePolygonsOnClick = () => {
        updatePastePolygonsAction(!pastePolygons);
    };

    const polygonModeOnClick = () => {
        updatePolygonDrawModeAction(!polygonLassoMode);
    };

    const lineKeypointModeOnClick = () => {
        const next = !lineKeypointMode;
        updateLineKeypointModeAction(next);
        if (next) {
            updateMovingAnnotationAction(true);
        }
    };

    const openImageClassFilter = () => {
        updateActivePopupTypeAction(PopupWindowType.IMAGE_CLASS_FILTER);
    };

    const withAI = (
        (activeLabelType === LabelType.RECT && AISelector.isAISSDObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isAIYOLOObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isRoboflowAPIModelLoaded()) ||
        (activeLabelType === LabelType.POINT && AISelector.isAIPoseDetectorModelLoaded())
    )

    return (
        <div className={getClassName()}>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'zoom-in',
                        'zoom in',
                        'ico/zoom-in.png',
                        'zoom-in',
                        false,
                        undefined,
                        () => ViewPortActions.zoomIn()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-out',
                        'zoom out',
                        'ico/zoom-out.png',
                        'zoom-out',
                        false,
                        undefined,
                        () => ViewPortActions.zoomOut()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-fit',
                        'fit image to available space',
                        'ico/zoom-fit.png',
                        'zoom-fit',
                        false,
                        undefined,
                        () => ViewPortActions.setDefaultZoom()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-max',
                        'maximum allowed image zoom',
                        'ico/zoom-max.png',
                        'zoom-max',
                        false,
                        undefined,
                        () => ViewPortActions.setOneForOneZoom()
                    )
                }
            </div>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'image-drag-mode',
                        imageDragMode ? 'turn-off image drag mode' : 'turn-on image drag mode - works only when image is zoomed',
                        'ico/hand.png',
                        'image-drag-mode',
                        imageDragMode,
                        undefined,
                        imageDragOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'cursor-cross-hair',
                        crossHairVisible ? 'turn-off cursor cross-hair' : 'turn-on cursor cross-hair',
                        'ico/cross-hair.png',
                        'cross-hair',
                        crossHairVisible,
                        undefined,
                        crossHairOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-fixed',
                        fixedZoom ? 'turn-off persistent zoom' : 'turn-on persistent zoom',
                        'ico/zoom-fixed.png',
                        'zoom-fixed',
                        fixedZoom,
                        undefined,
                        fixedZoomOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'ellipse-draw',
                        ellipseDraw ? 'turn-off ellipse draw' : 'turn-on ellipse draw',
                        'ico/ellipse.png',
                        'ellipse',
                        ellipseDraw,
                        undefined,
                        ellipseDrawOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'line-keypoint-mode',
                        lineKeypointMode ? 'turn-off line keypoints mode' : 'turn-on line keypoints mode (n clicks → n sequential keypoint polygons)',
                        'ico/keypoint-line.svg',
                        'line-keypoints',
                        lineKeypointMode,
                        undefined,
                        lineKeypointModeOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'polygon-draw-mode',
                        polygonLassoMode ? 'switch to point-click polygon mode' : 'switch to freehand polygon mode',
                        polygonLassoMode ? 'ico/polyline.png' : 'ico/polygon.png',
                        'polygon-draw-mode',
                        polygonLassoMode,
                        undefined,
                        polygonModeOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'moving-annotation',
                        movingAnnotation ? 'turn-off annotation moving' : 'turn-on annotation moving',
                        'ico/move-100.png',
                        'move',
                        movingAnnotation,
                        undefined,
                        movingAnnotationOnClick
                    )
                }
                
            </div>

            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'image-class-filter',
                        'open labels filter',
                        'ico/filter.svg',
                        'image-class-filter',
                        false,
                        undefined,
                        openImageClassFilter
                    )
                }
                {
                    getButtonWithTooltip(
                        'copy-polygons',
                        copyPolygons ? '' : 'copy all polygons',
                        'ico/copy-polygons.png',
                        'copy-polygons',
                        copyPolygons,
                        undefined,
                        copyPolygonsOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'paste-polygons',
                        pastePolygons ? '' : 'paste all copied polygons',
                        'ico/paste-polygons.png',
                        'paste-polygons',
                        pastePolygons,
                        undefined,
                        pastePolygonsOnClick
                    )
                }
            </div>
            {withAI && <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'accept-all',
                        'accept all proposed detections',
                        'ico/accept-all.png',
                        'accept-all',
                        false,
                        undefined,
                        () => AIActions.acceptAllSuggestedLabels(LabelsSelector.getActiveImageData())
                    )
                }
                {
                    getButtonWithTooltip(
                        'reject-all',
                        'reject all proposed detections',
                        'ico/reject-all.png',
                        'reject-all',
                        false,
                        undefined,
                        () => AIActions.rejectAllSuggestedLabels(LabelsSelector.getActiveImageData())
                    )
                }
            </div>}
        </div>
    );
};

const mapDispatchToProps = {
    updateImageDragModeStatusAction: updateImageDragModeStatus,
    updateCrossHairVisibleStatusAction: updateCrossHairVisibleStatus,
    updateFixedZoomStatusAction: updateFixedZoomStatus,
    updateEllipseDrawAction: updateEllipseDrawStatus,
    updateMovingAnnotationAction: updateMovingAnnotationStatus,
    updateCopyPolygonsAction: updateCopyPolygonsStatus,
    updatePastePolygonsAction: updatePasteAnnotationsStatus,
    updatePolygonDrawModeAction: updatePolygonDrawMode,
    updateLineKeypointModeAction: updateLineKeypointMode,
    updateActivePopupTypeAction: updateActivePopupType,
};

const mapStateToProps = (state: AppState) => ({
    activeContext: state.general.activeContext,
    imageDragMode: state.general.imageDragMode,
    crossHairVisible: state.general.crossHairVisible,
    fixedZoom: state.general.fixedZoom,
    ellipseDraw: state.general.ellipseDraw,
    movingAnnotation: state.general.movingAnnotation,
    copyPolygons: state.general.copyPolygons,
    pastePolygons: state.general.pastePolygons,
    activeLabelType: state.labels.activeLabelType,
    polygonLassoMode: state.general.polygonLassoMode,
    lineKeypointMode: state.general.lineKeypointMode,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorTopNavigationBar);
