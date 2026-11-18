import React from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import './EditorTools.scss';
import { AppState } from '../../../store';
import { ViewPortActions } from '../../../logic/actions/ViewPortActions';
import { ImageHistoryActions } from '../../../logic/actions/ImageHistoryActions';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { ViewPointSettings } from '../../../settings/ViewPointSettings';
import { updateCrossHairVisibleStatus, updateImageDragModeStatus } from '../../../store/general/actionCreators';

interface IProps {
    imageDragMode: boolean;
    crossHairVisible: boolean;
    canUndo: boolean;
    canRedo: boolean;
    updateImageDragModeStatusAction: (imageDragMode: boolean) => any;
    updateCrossHairVisibleStatusAction: (crossHairVisible: boolean) => any;
}

type Tool = {
    label: string;
    hint: string;
    icon: string;
    onClick: () => void;
    isActive?: boolean;
    isDisabled?: boolean;
};

// The image tools of the top bar, each with its name under its icon
const EditorTools: React.FC<IProps> = ({
    imageDragMode,
    crossHairVisible,
    canUndo,
    canRedo,
    updateImageDragModeStatusAction,
    updateCrossHairVisibleStatusAction,
}) => {
    // Moving the image only makes sense once it is zoomed in
    const imageDragOnClick = () => {
        if (imageDragMode || GeneralSelector.getZoom() !== ViewPointSettings.MIN_ZOOM) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
    };

    const toolGroups: Tool[][] = [
        [
            {label: 'Zoom in', hint: 'Make the image bigger', icon: 'ico/zoom-in.png',
                onClick: () => ViewPortActions.zoomIn()},
            {label: 'Zoom out', hint: 'Make the image smaller', icon: 'ico/zoom-out.png',
                onClick: () => ViewPortActions.zoomOut()},
            {label: 'Whole image', hint: 'Show the whole image', icon: 'ico/zoom-fit.png',
                onClick: () => ViewPortActions.setDefaultZoom()},
            {label: 'Move image', hint: 'Drag the image around (once zoomed in)', icon: 'ico/hand.png',
                onClick: imageDragOnClick, isActive: imageDragMode},
            {label: 'Guide lines', hint: 'Show lines following the mouse', icon: 'ico/cross-hair.png',
                onClick: () => updateCrossHairVisibleStatusAction(!crossHairVisible), isActive: crossHairVisible},
        ],
        [
            {label: 'Undo', hint: 'Undo the last change on this image (Ctrl+Z)', icon: 'ico/undo.svg',
                onClick: () => ImageHistoryActions.undoActiveImageAction(), isDisabled: !canUndo},
            {label: 'Redo', hint: 'Redo the change you undid (Ctrl+Y)', icon: 'ico/redo.svg',
                onClick: () => ImageHistoryActions.redoActiveImageAction(), isDisabled: !canRedo},
        ],
    ];

    return (
        <div className='EditorTools'>
            {toolGroups.map((tools: Tool[], index: number) => <div className='ToolGroup' key={index}>
                {tools.map((tool: Tool) => <button
                    key={tool.label}
                    type='button'
                    className={classNames('ToolButton', {active: tool.isActive})}
                    title={tool.hint}
                    disabled={tool.isDisabled}
                    onClick={tool.onClick}
                >
                    <img draggable={false} src={tool.icon} alt={''}/>
                    <span>{tool.label}</span>
                </button>)}
            </div>)}
        </div>
    );
};

const isActiveImageHistory = (state: AppState): boolean => {
    const activeImageData = state.labels.activeImageIndex === null
        ? null
        : state.labels.imagesData[state.labels.activeImageIndex];
    return !!activeImageData && state.labels.imageDataHistory.imageId === activeImageData.id;
};

const mapStateToProps = (state: AppState) => ({
    imageDragMode: state.general.imageDragMode,
    crossHairVisible: state.general.crossHairVisible,
    canUndo: isActiveImageHistory(state) && state.labels.imageDataHistory.past.length > 0,
    canRedo: isActiveImageHistory(state) && state.labels.imageDataHistory.future.length > 0,
});

export default connect(
    mapStateToProps,
    {
        updateImageDragModeStatusAction: updateImageDragModeStatus,
        updateCrossHairVisibleStatusAction: updateCrossHairVisibleStatus,
    }
)(EditorTools);
