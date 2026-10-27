import React, {useState} from 'react';
import {connect} from 'react-redux';
import {Direction} from '../../../data/enums/Direction';
import {ISize} from '../../../interfaces/ISize';
import {Settings} from '../../../settings/Settings';
import {AppState} from '../../../store';
import {ImageData} from '../../../store/labels/types';
import ImagesList from '../SideNavigationBar/ImagesList/ImagesList';
import LabelsToolkit from '../SideNavigationBar/LabelsToolkit/LabelsToolkit';
import TagsToolkit from '../SideNavigationBar/TagsToolkit/TagsToolkit';
import {SideNavigationBar} from '../SideNavigationBar/SideNavigationBar';
import {VerticalEditorButton} from '../VerticalEditorButton/VerticalEditorButton';
import './EditorContainer.scss';
import Editor from '../Editor/Editor';
import {ContextManager} from '../../../logic/context/ContextManager';
import {ContextType} from '../../../data/enums/ContextType';
import EditorBottomNavigationBar from '../EditorBottomNavigationBar/EditorBottomNavigationBar';
import EditorTopNavigationBar from '../EditorTopNavigationBar/EditorTopNavigationBar';
import {ProjectType} from '../../../data/enums/ProjectType';

type RightSideBarTab = 'LABELS' | 'TAGS';

interface IProps {
    windowSize: ISize;
    activeImageIndex: number | null;
    imagesData: ImageData[];
    activeContext: ContextType;
    projectType: ProjectType;
}

const EditorContainer: React.FC<IProps> = (
    {
        windowSize,
        activeImageIndex,
        imagesData,
        activeContext,
        projectType
    }) => {
    const [leftTabStatus, setLeftTabStatus] = useState(true);
    // The Labels and Tags tabs share the right side bar: null when it is closed.
    const [rightTab, setRightTab] = useState<RightSideBarTab | null>('LABELS');
    const rightTabStatus = rightTab !== null;
    const activeImageData = activeImageIndex === null ? null : imagesData[activeImageIndex];


    const calculateEditorSize = (): ISize => {
        if (windowSize) {
            const leftTabWidth = leftTabStatus ? Settings.SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            const rightTabWidth = rightTabStatus ? Settings.SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            return {
                width: windowSize.width - leftTabWidth - rightTabWidth,
                height: windowSize.height - Settings.TOP_NAVIGATION_BAR_HEIGHT_PX
                    - Settings.EDITOR_BOTTOM_NAVIGATION_BAR_HEIGHT_PX - Settings.EDITOR_TOP_NAVIGATION_BAR_HEIGHT_PX,
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

    const rightSideBarButtonOnClick = (tab: RightSideBarTab) => {
        if (rightTab === tab) {
            if (activeContext === ContextType.RIGHT_NAVBAR)
                ContextManager.restoreCtx();

            setRightTab(null);
            return;
        }

        // The right side bar context has no shortcut at all, so the tags panel never takes it:
        // tagging relies on the editor shortcuts (Shift+1...9, previous / next image, undo).
        if (tab === 'TAGS' && activeContext === ContextType.RIGHT_NAVBAR)
            ContextManager.switchCtx(ContextType.EDITOR);
        else if (tab === 'LABELS' && !rightTabStatus)
            ContextManager.switchCtx(ContextType.RIGHT_NAVBAR);

        setRightTab(tab);
    };

    const rightSideBarCompanionRender = () => {
        return <>
            <VerticalEditorButton
                label='Labels'
                image={'/ico/tags.png'}
                imageAlt={'labels'}
                onClick={() => rightSideBarButtonOnClick('LABELS')}
                isActive={rightTab === 'LABELS'}
            />
            <VerticalEditorButton
                label='Tags'
                image={'/ico/labels.png'}
                imageAlt={'tags'}
                onClick={() => rightSideBarButtonOnClick('TAGS')}
                isActive={rightTab === 'TAGS'}
                style={{top: 161}}
            />
        </>
    };

    const rightSideBarRender = () => {
        return rightTab === 'TAGS' ? <TagsToolkit/> : <LabelsToolkit/>
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
                {projectType === ProjectType.OBJECT_DETECTION && activeImageData && <EditorTopNavigationBar
                    key='editor-top-navigation-bar'
                />}
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
    projectType: state.general.projectData.type
});

export default connect(
    mapStateToProps
)(EditorContainer);
