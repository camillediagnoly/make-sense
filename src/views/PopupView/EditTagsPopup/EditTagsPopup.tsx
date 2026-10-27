import React, { useMemo, useState } from 'react';
import './EditTagsPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import Scrollbars from 'react-custom-scrollbars-2';
import { v4 as uuidv4 } from 'uuid';
import { sample, uniq } from 'lodash';
import { ImageButton } from '../../Common/ImageButton/ImageButton';
import { StyledTextField } from '../../Common/StyledTextField/StyledTextField';
import { ColorSelectorView } from '../InsertLabelNamesPopup/ColorSelectorView/ColorSelectorView';
import { ImageData, TagConfig, TagName } from '../../../store/labels/types';
import { PopupActions } from '../../../logic/actions/PopupActions';
import { TagActions } from '../../../logic/actions/TagActions';
import { TagNameChanges, TagUtil } from '../../../utils/TagUtil';
import { Settings } from '../../../settings/Settings';
import { submitNewNotification } from '../../../store/notifications/actionCreators';
import { INotification } from '../../../store/notifications/types';
import { NotificationUtil } from '../../../utils/NotificationUtil';
import { NotificationsDataMap } from '../../../data/info/NotificationsData';
import { Notification } from '../../../data/enums/Notification';

type TagGroupEntry = {
    id: string;
    name: string;
};

// originalName is the name the tag had when the popup opened, null for a tag created in it. It is
// what tells a renamed tag apart from a deleted one followed by a new one. A tag points at its
// group by id, so renaming a group keeps its tags in it.
type TagEntry = {
    id: string;
    originalName: string | null;
    name: string;
    color: string;
    groupId: string | null;
};

const createEntries = (tagConfig: TagConfig) => {
    const groupEntries: TagGroupEntry[] = tagConfig.groupNames.map((groupName: string) => ({
        id: uuidv4(),
        name: groupName
    }));
    const tagEntries: TagEntry[] = tagConfig.tags.map((tag: TagName) => ({
        id: uuidv4(),
        originalName: tag.name,
        name: tag.name,
        color: tag.color,
        groupId: groupEntries.find((groupEntry: TagGroupEntry) => groupEntry.name === tag.groupName)?.id ?? null
    }));
    return { groupEntries, tagEntries };
};

interface IProps {
    tagConfig: TagConfig;
    imagesData: ImageData[];
    submitNewNotificationAction: (notification: INotification) => any;
}

const EditTagsPopup: React.FC<IProps> = (
    {
        tagConfig,
        imagesData,
        submitNewNotificationAction
    }) => {
    const [initialEntries] = useState(() => createEntries(tagConfig));
    const [groupEntries, setGroupEntries] = useState<TagGroupEntry[]>(initialEntries.groupEntries);
    const [tagEntries, setTagEntries] = useState<TagEntry[]>(initialEntries.tagEntries);

    const getEntryName = (entry: TagEntry | TagGroupEntry): string => entry.name.trim();

    // Only the tags that got renamed or deleted are part of the changes, mapped to their new name or
    // to null.
    const getTagNameChanges = (entries: TagEntry[]): TagNameChanges => {
        const finalNameByOriginalName = new Map<string, string>();
        entries
            .filter((tagEntry: TagEntry) => tagEntry.originalName !== null)
            .forEach((tagEntry: TagEntry) =>
                finalNameByOriginalName.set(tagEntry.originalName, getEntryName(tagEntry))
            );

        const changes: TagNameChanges = new Map();
        TagUtil.getTagNames(tagConfig).forEach((tagName: string) => {
            const finalName: string | undefined = finalNameByOriginalName.get(tagName);
            if (finalName === undefined) {
                changes.set(tagName, null);
            } else if (finalName !== tagName) {
                changes.set(tagName, finalName);
            }
        });
        return changes;
    };

    // Accepting removes every deleted tag from the images that carry it, so the count is shown
    // upfront.
    const pendingRemoval = useMemo(
        () => {
            const removedTagNames: string[] = [];
            getTagNameChanges(tagEntries).forEach((newTagName: string | null, tagName: string) => {
                if (newTagName === null) {
                    removedTagNames.push(tagName);
                }
            });
            return {
                tagNamesCount: removedTagNames.length,
                instancesCount: TagUtil.countTagInstances(imagesData, removedTagNames)
            };
        },
        [tagEntries, imagesData]
    );

    const callbackWithNamesValidation = (callback: () => any): () => any => {
        return () => {
            const tagNames: string[] = tagEntries.map(getEntryName);
            const groupNames: string[] = groupEntries.map(getEntryName);
            if ([...tagNames, ...groupNames].some((name: string) => name.length === 0)) {
                submitNewNotificationAction(NotificationUtil
                    .createErrorNotification(NotificationsDataMap[Notification.EMPTY_TAG_NAME_ERROR]));
                return;
            }
            if (uniq(tagNames).length !== tagNames.length || uniq(groupNames).length !== groupNames.length) {
                submitNewNotificationAction(NotificationUtil
                    .createErrorNotification(NotificationsDataMap[Notification.NON_UNIQUE_TAG_NAMES_ERROR]));
                return;
            }
            callback();
        };
    };

    const addTagEntryCallback = () => {
        const tagName: TagName = TagUtil.createTagName('');
        setTagEntries([...tagEntries, {
            id: uuidv4(),
            originalName: null,
            name: tagName.name,
            color: tagName.color,
            groupId: null
        }]);
    };

    const safeAddTagEntryCallback = () => callbackWithNamesValidation(addTagEntryCallback)();

    const addGroupEntryCallback = () => {
        setGroupEntries([...groupEntries, { id: uuidv4(), name: '' }]);
    };

    const safeAddGroupEntryCallback = () => callbackWithNamesValidation(addGroupEntryCallback)();

    const deleteTagEntryCallback = (id: string) => {
        setTagEntries(tagEntries.filter((tagEntry: TagEntry) => tagEntry.id !== id));
    };

    // The tags of a deleted group are kept, without group
    const deleteGroupEntryCallback = (id: string) => {
        setGroupEntries(groupEntries.filter((groupEntry: TagGroupEntry) => groupEntry.id !== id));
        setTagEntries(tagEntries.map((tagEntry: TagEntry) =>
            tagEntry.groupId === id ? { ...tagEntry, groupId: null } : tagEntry
        ));
    };

    const updateTagEntry = (id: string, update: Partial<TagEntry>) => {
        setTagEntries(tagEntries.map((tagEntry: TagEntry) =>
            tagEntry.id === id ? { ...tagEntry, ...update } : tagEntry
        ));
    };

    const updateGroupEntryName = (id: string, name: string) => {
        setGroupEntries(groupEntries.map((groupEntry: TagGroupEntry) =>
            groupEntry.id === id ? { ...groupEntry, name } : groupEntry
        ));
    };

    const onTagKeyUpCallback = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            safeAddTagEntryCallback();
        }
    };

    const onGroupKeyUpCallback = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            safeAddGroupEntryCallback();
        }
    };

    const onAcceptCallback = () => {
        const groupNameById = new Map<string, string>(
            groupEntries.map((groupEntry: TagGroupEntry): [string, string] => [groupEntry.id, getEntryName(groupEntry)])
        );
        const tags: TagName[] = tagEntries.map((tagEntry: TagEntry) => ({
            name: getEntryName(tagEntry),
            color: tagEntry.color,
            groupName: groupNameById.get(tagEntry.groupId)
        }));

        TagActions.applyTagConfigChanges(
            TagUtil.createTagConfig(tags, groupEntries.map(getEntryName)),
            getTagNameChanges(tagEntries)
        );
        PopupActions.close();
    };

    const safeOnAcceptCallback = () => callbackWithNamesValidation(onAcceptCallback)();

    const onRejectCallback = () => {
        PopupActions.close();
    };

    const groupInputs = groupEntries.map((groupEntry: TagGroupEntry) => {
        return <div className='TagEntry' key={groupEntry.id}>
            <StyledTextField variant='standard'
                autoComplete={'off'}
                autoFocus={true}
                type={'text'}
                margin={'dense'}
                label={'Insert group'}
                onKeyUp={onGroupKeyUpCallback}
                value={groupEntry.name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    updateGroupEntryName(groupEntry.id, event.target.value)}
                style={{ width: 280 }}
                InputLabelProps={{
                    shrink: true,
                }}
            />
            <ImageButton
                image={'ico/trash.png'}
                imageAlt={'remove_group'}
                buttonSize={{ width: 30, height: 30 }}
                onClick={() => deleteGroupEntryCallback(groupEntry.id)}
            />
        </div>;
    });

    const tagInputs = tagEntries.map((tagEntry: TagEntry) => {
        return <div className='TagEntry' key={tagEntry.id}>
            <StyledTextField variant='standard'
                autoComplete={'off'}
                autoFocus={true}
                type={'text'}
                margin={'dense'}
                label={'Insert tag'}
                onKeyUp={onTagKeyUpCallback}
                value={tagEntry.name}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    updateTagEntry(tagEntry.id, { name: event.target.value })}
                style={{ width: 280 }}
                InputLabelProps={{
                    shrink: true,
                }}
            />
            <ColorSelectorView
                color={tagEntry.color}
                onClick={() => updateTagEntry(tagEntry.id, { color: sample(Settings.LABEL_COLORS_PALETTE) })}
            />
            {groupEntries.length > 0 && <select
                className='TagGroupSelect'
                value={tagEntry.groupId ?? ''}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    updateTagEntry(tagEntry.id, { groupId: event.target.value || null })}
            >
                <option value=''>No group</option>
                {groupEntries.map((groupEntry: TagGroupEntry) =>
                    <option key={groupEntry.id} value={groupEntry.id}>
                        {getEntryName(groupEntry) || '(unnamed group)'}
                    </option>
                )}
            </select>}
            <ImageButton
                image={'ico/trash.png'}
                imageAlt={'remove_tag'}
                buttonSize={{ width: 30, height: 30 }}
                onClick={() => deleteTagEntryCallback(tagEntry.id)}
            />
        </div>;
    });

    const renderContent = () => {
        return (<div className='EditTagsPopup'>
            <div className='LeftContainer'>
                <ImageButton
                    image={'ico/plus.png'}
                    imageAlt={'add_tag'}
                    buttonSize={{ width: 40, height: 40 }}
                    padding={25}
                    onClick={safeAddTagEntryCallback}
                    externalClassName={'monochrome'}
                />
                <ImageButton
                    image={'ico/files.png'}
                    imageAlt={'add_group'}
                    buttonSize={{ width: 40, height: 40 }}
                    padding={18}
                    onClick={safeAddGroupEntryCallback}
                    externalClassName={'monochrome'}
                />
            </div>
            <div className='RightContainer'>
                <div className='Message'>
                    You can now edit the tags you put on whole images, like Physio or Patho. They are saved
                    apart from the labels, so they never become classes. Use the + button to add a new tag,
                    and the folder button to add a group gathering several tags.
                </div>
                {pendingRemoval.instancesCount > 0 && <div className='RemovedInstancesWarning'>
                    {`Accepting will also remove the ${pendingRemoval.instancesCount} `}
                    {pendingRemoval.instancesCount === 1 ? 'assignment' : 'assignments'}
                    {' of the '}
                    {pendingRemoval.tagNamesCount === 1
                        ? 'tag you deleted.'
                        : `${pendingRemoval.tagNamesCount} tags you deleted.`}
                </div>}
                <div className='TagsContainer'>
                    {tagEntries.length !== 0 || groupEntries.length !== 0 ? <Scrollbars>
                        <div className='EditTagsPopupContent'>
                            {groupEntries.length !== 0 && <>
                                <div className='SectionTitle'>Groups</div>
                                {groupInputs}
                                <div className='SectionTitle'>Tags</div>
                            </>}
                            {tagInputs}
                        </div>
                    </Scrollbars> :
                        <div
                            className='EmptyList'
                            onClick={addTagEntryCallback}
                        >
                            <img
                                draggable={false}
                                alt={'empty_tag_list'}
                                src={'ico/type-writer.png'}
                            />
                            <p className='extraBold'>Your tag list is empty</p>
                        </div>}
                </div>
            </div>
        </div>);
    };

    return (
        <GenericYesNoPopup
            title={'Edit tags'}
            renderContent={renderContent}
            acceptLabel={'Accept'}
            onAccept={safeOnAcceptCallback}
            rejectLabel={'Cancel'}
            onReject={onRejectCallback}
            popupClassName={'EditTagsPopupDialog'}
        />);
};

const mapDispatchToProps = {
    submitNewNotificationAction: submitNewNotification
};

const mapStateToProps = (state: AppState) => ({
    tagConfig: state.labels.tagConfig,
    imagesData: state.labels.imagesData
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditTagsPopup);
