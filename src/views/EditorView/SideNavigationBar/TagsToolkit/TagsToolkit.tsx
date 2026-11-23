import React, { useState } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Scrollbars from 'react-custom-scrollbars-2';
import { AppState } from '../../../../store';
import { ImageData, TagConfig, TagName } from '../../../../store/labels/types';
import { updateActivePopupType } from '../../../../store/general/actionCreators';
import { PopupWindowType } from '../../../../data/enums/PopupWindowType';
import { LabelType } from '../../../../data/enums/LabelType';
import { ContextType } from '../../../../data/enums/ContextType';
import { ContextManager } from '../../../../logic/context/ContextManager';
import { TagActions } from '../../../../logic/actions/TagActions';
import { TagGroup, TagUtil } from '../../../../utils/TagUtil';
import { DrawUtil } from '../../../../utils/DrawUtil';
import { Settings } from '../../../../settings/Settings';
import './TagsToolkit.scss';

// Key of the tags without group in the collapsed groups list (no group can have an empty name)
const UNGROUPED_TAGS_KEY = '';

// Kept at module level so the folded groups stay folded while switching between Labels and Tags
let collapsedGroupKeys: string[] = [];

interface IProps {
    activeImageIndex: number | null;
    imagesData: ImageData[];
    tagConfig: TagConfig;
    activeLabelType: LabelType;
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
}

const TagsToolkit: React.FC<IProps> = (
    {
        activeImageIndex,
        imagesData,
        tagConfig,
        activeLabelType,
        updateActivePopupTypeAction
    }) => {
    const [collapsedGroups, setCollapsedGroups] = useState<string[]>(collapsedGroupKeys);
    const activeImageData: ImageData | null = activeImageIndex === null ? null : imagesData[activeImageIndex];
    const tagNames: string[] = TagUtil.getTagNames(tagConfig);
    const shortcutTagNames: string[] = TagUtil.getShortcutTagNames(tagConfig);

    const openEditTagsPopup = () => updateActivePopupTypeAction(PopupWindowType.EDIT_TAGS);

    // Unlike the labels panel, this one hands the editor context back on click: tagging relies on
    // the editor shortcuts (Shift+1...9, previous / next image, undo).
    const onMouseDown = () => ContextManager.switchCtx(ContextType.EDITOR);

    const toggleGroup = (groupKey: string) => {
        collapsedGroupKeys = collapsedGroups.includes(groupKey)
            ? collapsedGroups.filter((collapsedGroupKey: string) => collapsedGroupKey !== groupKey)
            : [...collapsedGroups, groupKey];
        setCollapsedGroups(collapsedGroupKeys);
    };

    // The eye of a group only drives the Shift+1...9 shortcuts of its tags (one eye per tag lives
    // in the Edit TAGs popup): a disabled tag stays shown and clickable. The click stops there,
    // so it does not fold the group.
    const renderGroupShortcutToggle = (isShortcutEnabled: boolean, title: string, onToggle: () => void) => {
        return <img
            draggable={false}
            className='TagShortcutToggle'
            src={isShortcutEnabled ? 'ico/eye.png' : 'ico/hide.png'}
            alt={'shortcut_toggle'}
            title={title}
            onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                onToggle();
            }}
        />
    };

    const renderTag = (tag: TagName, isActive: boolean) => {
        const shortcutIndex: number = shortcutTagNames.indexOf(tag.name);
        const isShortcutEnabled: boolean = !tag.isShortcutDisabled;
        const tagStyle = {
            '--tag-color': tag.color,
            '--tag-active-background': DrawUtil.hexToRGB(tag.color, 0.35),
        } as React.CSSProperties;

        return <div
            className={classNames('TagItem', {'active': isActive, 'shortcutDisabled': !isShortcutEnabled})}
            style={tagStyle}
            onClick={() => TagActions.toggleTagOnActiveImage(tag.name)}
            title={isActive ? 'Remove this tag from the image' : 'Add this tag to the image'}
            key={tag.name}
        >
            <span className='TagColorDot'/>
            {shortcutIndex !== -1 && <span className='TagIndex'>{shortcutIndex + 1}</span>}
            {tag.name}
        </div>
    };

    const renderTagList = (tags: TagName[], isActive: boolean, emptyMessage: string) => {
        return <div className='TagsSectionContent'>
            {tags.length > 0 ?
                tags.map((tag: TagName) => renderTag(tag, isActive)) :
                <div className='EmptyTagsMessage'>{emptyMessage}</div>
            }
        </div>
    };

    const renderSectionHeader = (title: string) => {
        return <div className='Header' style={{height: Settings.TOOLKIT_TAB_HEIGHT_PX}}>
            <div className='Marker'/>
            <div className='HeaderGroupWrapper'>
                {title}
            </div>
        </div>
    };

    // Without any group, the available tags are a single list. Otherwise every group that holds
    // tags gets its own foldable list, followed by the tags without group.
    const renderAvailableTags = (availableTags: TagName[]) => {
        if (tagConfig.groupNames.length === 0) {
            return renderTagList(availableTags, false, 'Every tag is already on this image');
        }

        return TagUtil.getTagGroups(tagConfig)
            .filter((tagGroup: TagGroup) => tagGroup.tags.length > 0)
            .map((tagGroup: TagGroup) => {
                const groupKey: string = tagGroup.groupName ?? UNGROUPED_TAGS_KEY;
                const isCollapsed: boolean = collapsedGroups.includes(groupKey);
                const groupAvailableTags: TagName[] = tagGroup.tags
                    .filter((tag: TagName) => availableTags.includes(tag));
                // The group eye covers every tag of the group, including the ones on the image
                const isGroupShortcutEnabled: boolean = tagGroup.tags
                    .some((tag: TagName) => !tag.isShortcutDisabled);

                return <div className='TagGroup' key={groupKey}>
                    <div
                        className={classNames('TagGroupHeader', {'collapsed': isCollapsed})}
                        onClick={() => toggleGroup(groupKey)}
                    >
                        <img
                            draggable={false}
                            className='Arrow'
                            src={'ico/down.png'}
                            alt={'down_arrow'}
                        />
                        {`${tagGroup.groupName ?? 'Other tags'} (${groupAvailableTags.length})`}
                        {renderGroupShortcutToggle(
                            isGroupShortcutEnabled,
                            isGroupShortcutEnabled
                                ? 'Remove every tag of this group from the Shift+1...9 shortcuts'
                                : 'Give every tag of this group a Shift+1...9 shortcut again',
                            () => TagActions.setTagsShortcutDisabled(
                                tagGroup.tags.map((tag: TagName) => tag.name),
                                isGroupShortcutEnabled
                            )
                        )}
                    </div>
                    {!isCollapsed && groupAvailableTags.length > 0 &&
                        renderTagList(groupAvailableTags, false, '')}
                </div>
            });
    };

    const renderContent = () => {
        if (tagConfig.tags.length === 0) {
            return <div
                className='EmptyTagList'
                onClick={openEditTagsPopup}
            >
                <img
                    draggable={false}
                    alt={'empty_tag_list'}
                    src={'ico/type-writer.png'}
                />
                <p className='extraBold'>Your tag list is empty</p>
                <p>Click here to create your first tags</p>
            </div>
        }

        const activeTagNames: string[] = TagUtil.getActiveTagNames(activeImageData, tagNames);
        const activeTags: TagName[] = tagConfig.tags.filter((tag: TagName) => activeTagNames.includes(tag.name));
        const availableTags: TagName[] = tagConfig.tags.filter((tag: TagName) => !activeTagNames.includes(tag.name));
        // Only the images with polygons end up in the COCO file and the ones with rectangles in the
        // VOC files, together with their tags.
        const isRectProject: boolean = activeLabelType === LabelType.RECT;
        const areTagsNotSaved: boolean = activeTags.length > 0 &&
            (isRectProject ? activeImageData.labelRects : activeImageData.labelPolygons).length === 0;

        return <>
            <div className='TagsToolkitBody'>
                <Scrollbars style={{position: 'absolute', top: 0, left: 0}}>
                    <div className='TagsSection active'>
                        {renderSectionHeader(`Active TAGs (${activeTags.length})`)}
                        {renderTagList(activeTags, true, 'No tag on this image yet')}
                    </div>
                    {areTagsNotSaved && <div className='TagsNotSavedWarning'>
                        Tags are only saved for images with at least one {isRectProject ? 'rectangle' : 'polygon'}.
                    </div>}
                    <div className='TagsSection'>
                        {renderSectionHeader(`Available TAGs (${availableTags.length})`)}
                        {renderAvailableTags(availableTags)}
                    </div>
                </Scrollbars>
            </div>
            <div
                className='EditTagsButton'
                style={{height: Settings.TOOLKIT_TAB_HEIGHT_PX}}
                onClick={openEditTagsPopup}
            >
                <img
                    draggable={false}
                    alt={'edit_tags'}
                    src={'ico/labels.png'}
                />
                Edit TAGs
            </div>
        </>
    };

    return (
        <div
            className='TagsToolkit'
            onMouseDown={onMouseDown}
        >
            {activeImageData && renderContent()}
        </div>
    );
};

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType
};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    tagConfig: state.labels.tagConfig,
    activeLabelType: state.labels.activeLabelType
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(TagsToolkit);
