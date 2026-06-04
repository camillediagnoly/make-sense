import { ContextType } from '../../../data/enums/ContextType';
import './EditorTopNavigationBar.scss';
import React from 'react';
import classNames from 'classnames';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateCrossHairVisibleStatus, updateImageDragModeStatus, updateFixedZoomStatus, updateEllipseDrawStatus, updateMovingAnnotationStatus, updateCopyPolygonsStatus, updatePasteAnnotationsStatus, updatePolygonDrawMode, updateActivePopupType, updateLineKeypointMode, updatePolygonLassoTargetVertexCount } from '../../../store/general/actionCreators';
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
import { ImageHistoryActions } from '../../../logic/actions/ImageHistoryActions';
import { ImageActions } from '../../../logic/actions/ImageActions';
import { ImageData } from '../../../store/labels/types';
import { FileSystemAccessUtil } from '../../../utils/FileSystemAccessUtil';
const BUTTON_SIZE: ISize = { width: 30, height: 30 };
const BUTTON_PADDING: number = 10;
const POLYGON_LASSO_PRECISION_OPTIONS = [
    { label: 'Large shape', targetVertexCount: 40 },
    { label: 'Default', targetVertexCount: 20 },
    { label: 'Small shape', targetVertexCount: 10 },
];

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
    onClick?: () => any,
    isDisabled: boolean = false,
    externalClassName?: string
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
                isDisabled={isDisabled}
                externalClassName={externalClassName}
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
    updatePolygonLassoTargetVertexCountAction: (polygonLassoTargetVertexCount: number) => any;
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
    polygonLassoTargetVertexCount: number;
    lineKeypointMode: boolean;
    canUndoActiveImageAction: boolean;
    canRedoActiveImageAction: boolean;
    activeImageData: ImageData | null;
    imagesData: ImageData[];
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
        updatePolygonLassoTargetVertexCountAction,
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
        polygonLassoTargetVertexCount,
        lineKeypointMode,
        canUndoActiveImageAction,
        canRedoActiveImageAction,
        activeImageData,
        imagesData
    }) => {
    const [isPolygonPrecisionMenuOpen, setIsPolygonPrecisionMenuOpen] = React.useState(false);
    const [isRefreshingLocalImageFolders, setIsRefreshingLocalImageFolders] = React.useState(false);

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

    const selectedPolygonPrecision = POLYGON_LASSO_PRECISION_OPTIONS.find(
        (option) => option.targetVertexCount === polygonLassoTargetVertexCount
    ) || POLYGON_LASSO_PRECISION_OPTIONS[1];

    const selectPolygonPrecision = (targetVertexCount: number) => {
        updatePolygonLassoTargetVertexCountAction(targetVertexCount);
        setIsPolygonPrecisionMenuOpen(false);
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

    const deleteActiveImageOnClick = () => {
        if (activeImageData) {
            if (FileSystemAccessUtil.requiresDeleteConfirmation(activeImageData)) {
                updateActivePopupTypeAction(PopupWindowType.DELETE_IMAGE);
            } else {
                ImageActions.deleteImage(activeImageData);
            }
        }
    };

    const refreshLocalImageFoldersOnClick = async () => {
        setIsRefreshingLocalImageFolders(true);
        try {
            await ImageActions.refreshLocalImageFolders();
        } finally {
            setIsRefreshingLocalImageFolders(false);
        }
    };

    const getDeleteImageTooltip = (): string => {
        if (activeImageData && FileSystemAccessUtil.canDeleteLocalFile(activeImageData)) {
            return 'delete current image from disk';
        }

        return 'local deletion unavailable - reopen images with Chrome file access';
    };

    const showLocalDeleteButton = FileSystemAccessUtil.supportsLocalFileDeletion();
    const canRefreshLocalImageFolders = ImageActions.canRefreshLocalImageFolders(imagesData);

    const withAI = (
        (activeLabelType === LabelType.RECT && AISelector.isAISSDObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isAIYOLOObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isRoboflowAPIModelLoaded()) ||
        (activeLabelType === LabelType.POINT && AISelector.isAIPoseDetectorModelLoaded())
    )

    const renderPolygonModeControl = () => (
        <div
            className='PolygonModeControl'
            onMouseLeave={() => setIsPolygonPrecisionMenuOpen(false)}
        >
            {getButtonWithTooltip(
                'polygon-draw-mode',
                polygonLassoMode ? 'switch to point-click polygon mode' : 'switch to freehand polygon mode',
                polygonLassoMode ? 'ico/polyline.png' : 'ico/polygon.png',
                'polygon-draw-mode',
                polygonLassoMode,
                undefined,
                polygonModeOnClick
            )}
            <button
                type='button'
                aria-label='Open freehand polygon precision menu'
                aria-haspopup='menu'
                aria-expanded={isPolygonPrecisionMenuOpen}
                className={classNames('PolygonPrecisionCaret', {
                    active: isPolygonPrecisionMenuOpen,
                })}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation();
                    setIsPolygonPrecisionMenuOpen(!isPolygonPrecisionMenuOpen);
                }}
            >
                <span className='CaretIcon' />
            </button>
            {isPolygonPrecisionMenuOpen && (
                <div className='PolygonPrecisionMenu' role='menu'>
                    <div className='PolygonPrecisionMenuTitle'>
                        Freehand precision
                    </div>
                    {POLYGON_LASSO_PRECISION_OPTIONS.map((option) => (
                        <button
                            key={option.targetVertexCount}
                            type='button'
                            role='menuitemradio'
                            aria-checked={
                                option.targetVertexCount ===
                                selectedPolygonPrecision.targetVertexCount
                            }
                            className={classNames('PolygonPrecisionOption', {
                                active:
                                    option.targetVertexCount ===
                                    selectedPolygonPrecision.targetVertexCount,
                            })}
                            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                                event.stopPropagation();
                                selectPolygonPrecision(option.targetVertexCount);
                            }}
                        >
                            <span>{option.label}</span>
                            <span>{`~${option.targetVertexCount} pts`}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

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
                    renderPolygonModeControl()
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
            <div className='ButtonWrapper'>
                {showLocalDeleteButton &&
                    getButtonWithTooltip(
                        'refresh-local-image-folders',
                        isRefreshingLocalImageFolders
                            ? 'refreshing local images'
                            : 'refresh local images',
                        'ico/refresh.png',
                        'refresh-local-image-folders',
                        isRefreshingLocalImageFolders,
                        undefined,
                        refreshLocalImageFoldersOnClick,
                        !canRefreshLocalImageFolders || isRefreshingLocalImageFolders,
                        classNames('RefreshLocalImageFoldersButton', {
                            refreshing: isRefreshingLocalImageFolders,
                        })
                    )
                }
                {showLocalDeleteButton &&
                    getButtonWithTooltip(
                        'delete-active-image',
                        getDeleteImageTooltip(),
                        'ico/trash.png',
                        'delete-active-image',
                        false,
                        undefined,
                        deleteActiveImageOnClick,
                        !activeImageData || !FileSystemAccessUtil.canDeleteLocalFile(activeImageData)
                    )
                }
                {
                    getButtonWithTooltip(
                        'undo-active-image-action',
                        'undo current image action (ctrl+z)',
                        'ico/undo.svg',
                        'undo',
                        false,
                        undefined,
                        () => ImageHistoryActions.undoActiveImageAction(),
                        !canUndoActiveImageAction
                    )
                }
                {
                    getButtonWithTooltip(
                        'redo-active-image-action',
                        'redo current image action (ctrl+y)',
                        'ico/redo.svg',
                        'redo',
                        false,
                        undefined,
                        () => ImageHistoryActions.redoActiveImageAction(),
                        !canRedoActiveImageAction
                    )
                }
            </div>
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
    updatePolygonLassoTargetVertexCountAction: updatePolygonLassoTargetVertexCount,
    updateLineKeypointModeAction: updateLineKeypointMode,
    updateActivePopupTypeAction: updateActivePopupType,
};

const mapStateToProps = (state: AppState) => {
    const activeImageData = state.labels.activeImageIndex === null
        ? null
        : state.labels.imagesData[state.labels.activeImageIndex];
    const imageDataHistory = state.labels.imageDataHistory;
    const hasActiveImageHistory = !!activeImageData && imageDataHistory.imageId === activeImageData.id;

    return {
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
        polygonLassoTargetVertexCount: state.general.polygonLassoTargetVertexCount,
        lineKeypointMode: state.general.lineKeypointMode,
        activeImageData,
        imagesData: state.labels.imagesData,
        canUndoActiveImageAction: hasActiveImageHistory && imageDataHistory.past.length > 0,
        canRedoActiveImageAction: hasActiveImageHistory && imageDataHistory.future.length > 0,
    };
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorTopNavigationBar);
