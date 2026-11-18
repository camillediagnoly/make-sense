import React, {useEffect, useState} from 'react';
import {connect} from 'react-redux';
import {Direction} from '../../../data/enums/Direction';
import {ISize} from '../../../interfaces/ISize';
import {Settings} from '../../../settings/Settings';
import {AppState} from '../../../store';
import {ImageData} from '../../../store/labels/types';
import ImagesList from '../SideNavigationBar/ImagesList/ImagesList';
import LabelsToolkit from '../SideNavigationBar/LabelsToolkit/LabelsToolkit';
import {SideNavigationBar} from '../SideNavigationBar/SideNavigationBar';
import {VerticalEditorButton} from '../VerticalEditorButton/VerticalEditorButton';
import './EditorContainer.scss';
import Editor from '../Editor/Editor';
import {ContextManager} from '../../../logic/context/ContextManager';
import {ContextType} from '../../../data/enums/ContextType';
import EditorBottomNavigationBar from '../EditorBottomNavigationBar/EditorBottomNavigationBar';
import {updateImageDataById} from '../../../store/labels/actionCreators';


interface IProps {
    windowSize: ISize;
    activeImageIndex: number | null;
    imagesData: ImageData[];
    activeContext: ContextType;
    updateImageDataByIdAction: (id: string, newImageData: ImageData) => any;
}

const EditorContainer: React.FC<IProps> = (
    {
        windowSize,
        activeImageIndex,
        imagesData,
        activeContext,
        updateImageDataByIdAction
    }) => {
    const [leftTabStatus, setLeftTabStatus] = useState(true);
    const [rightTabStatus, setRightTabStatus] = useState(true);
    const activeImageData = activeImageIndex === null ? null : imagesData[activeImageIndex];

    // The review progress: an image shown in the editor is seen
    useEffect(() => {
        if (activeImageData && !activeImageData.isSeen) {
            updateImageDataByIdAction(activeImageData.id, {...activeImageData, isSeen: true});
        }
    }, [activeImageData, updateImageDataByIdAction]);


    const calculateEditorSize = (): ISize => {
        if (windowSize) {
            const leftTabWidth = leftTabStatus ? Settings.LEFT_SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            const rightTabWidth = rightTabStatus ? Settings.RIGHT_SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            // The tools are in the bottom bar: no editor top bar
            return {
                width: windowSize.width - leftTabWidth - rightTabWidth,
                height: windowSize.height - Settings.TOP_NAVIGATION_BAR_HEIGHT_PX
                    - Settings.EDITOR_BOTTOM_NAVIGATION_BAR_HEIGHT_PX,
            }
        }
        else
            return null;
    };

    const leftSideBarButtonOnClick = () => {
        if (!leftTabStatus)
            ContextManager.switchCtx(ContextType.LEFT_NAVBAR);
        else if (leftTabStatus && activeContext === ContextType.LEFT_NAVBAR)
            ContextManager.restoreCtx();

        setLeftTabStatus(!leftTabStatus);
    };

    const leftSideBarCompanionRender = () => {
        return <>
            <VerticalEditorButton
                label='Images'
                image={'/ico/camera.png'}
                imageAlt={'images'}
                onClick={leftSideBarButtonOnClick}
                isActive={leftTabStatus}
            />
        </>
    };

    const leftSideBarRender = () => {
        return <ImagesList/>
    };

    const rightSideBarButtonOnClick = () => {
        if (!rightTabStatus)
            ContextManager.switchCtx(ContextType.RIGHT_NAVBAR);
        else if (rightTabStatus && activeContext === ContextType.RIGHT_NAVBAR)
            ContextManager.restoreCtx();

        setRightTabStatus(!rightTabStatus);
    };

    const rightSideBarCompanionRender = () => {
        return <>
            <VerticalEditorButton
                label='Annotations'
                image={'/ico/tags.png'}
                imageAlt={'annotations'}
                onClick={rightSideBarButtonOnClick}
                isActive={rightTabStatus}
            />
        </>
    };

    const rightSideBarRender = () => {
        return <LabelsToolkit/>
    };

    return (
        <div className='EditorContainer'>
            <SideNavigationBar
                direction={Direction.LEFT}
                isOpen={leftTabStatus}
                isWithContext={activeContext === ContextType.LEFT_NAVBAR}
                renderCompanion={leftSideBarCompanionRender}
                renderContent={leftSideBarRender}
                key='left-side-navigation-bar'
            />
            <div className='EditorWrapper'
                onMouseDown={() => ContextManager.switchCtx(ContextType.EDITOR)}
                 key='editor-wrapper'
            >
                {activeImageData ? <Editor
                    size={calculateEditorSize()}
                    imageData={activeImageData}
                    key='editor'
                /> : <div className='EmptyEditorState'>
                    No image selected
                </div>}
                {activeImageData && <EditorBottomNavigationBar
                    imageData={activeImageData}
                    size={calculateEditorSize()}
                    key='editor-bottom-navigation-bar'
                />}
            </div>
            <SideNavigationBar
                direction={Direction.RIGHT}
                isOpen={rightTabStatus}
                isWithContext={activeContext === ContextType.RIGHT_NAVBAR}
                renderCompanion={rightSideBarCompanionRender}
                renderContent={rightSideBarRender}
                key='right-side-navigation-bar'
            />
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    windowSize: state.general.windowSize,
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    activeContext: state.general.activeContext,
});

export default connect(
    mapStateToProps,
    {updateImageDataByIdAction: updateImageDataById}
)(EditorContainer);
