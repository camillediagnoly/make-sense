import { sample } from 'lodash';
import { ImageData, TagConfig, TagName } from '../store/labels/types';
import { Settings } from '../settings/Settings';

const TAG_FILTER_TOKEN_PREFIX = '__image_tag__:';

// Maps the name a tag had when an edit started to the name it ends up with, or to null when the
// tag gets deleted.
export type TagNameChanges = Map<string, string | null>;

// The tags of one group, or the tags without any group when groupName is null
export type TagGroup = {
    groupName: string | null;
    tags: TagName[];
};

export class TagUtil {
    // Like a new label name, a new tag gets a random color of the label palette
    public static createTagName(name: string, groupName?: string): TagName {
        return {
            name,
            color: sample(Settings.LABEL_COLORS_PALETTE),
            ...(groupName ? { groupName } : {})
        };
    }

    // Every tag config goes through here: a tag pointing at a group that does not exist loses it,
    // and the tags get sorted group by group, in the order of the groups, the ones without group
    // last. That is the order they are shown in, exported in, and toggled in with Shift+1...9.
    public static createTagConfig(tags: TagName[], groupNames: string[]): TagConfig {
        const normalizedGroupNames: string[] = TagUtil.normalizeTagNames(groupNames);
        const getGroupIndex = (tag: TagName): number => normalizedGroupNames.includes(tag.groupName)
            ? normalizedGroupNames.indexOf(tag.groupName)
            : normalizedGroupNames.length;

        const sortedTags: TagName[] = tags
            .map((tag: TagName, index: number) => ({ tag, index }))
            .sort((a, b) => getGroupIndex(a.tag) - getGroupIndex(b.tag) || a.index - b.index)
            .map(({ tag }) => normalizedGroupNames.includes(tag.groupName)
                ? tag
                : { name: tag.name, color: tag.color });

        return {
            tags: sortedTags,
            groupNames: normalizedGroupNames
        };
    }

    // Keeps the tags the project already holds as they are (color, group) and appends the imported
    // ones it does not know yet.
    public static mergeTagConfigs(currentTagConfig: TagConfig, importedTagConfig: TagConfig): TagConfig {
        const currentTagNames: string[] = TagUtil.getTagNames(currentTagConfig);
        return TagUtil.createTagConfig(
            [
                ...currentTagConfig.tags,
                ...importedTagConfig.tags.filter((tag: TagName) => !currentTagNames.includes(tag.name))
            ],
            TagUtil.mergeTagNames(currentTagConfig.groupNames, importedTagConfig.groupNames)
        );
    }

    public static getTagNames(tagConfig: TagConfig): string[] {
        return tagConfig.tags.map((tag: TagName) => tag.name);
    }

    // Every group in order, even an empty one, followed by the tags without group if there are any
    public static getTagGroups(tagConfig: TagConfig): TagGroup[] {
        const tagGroups: TagGroup[] = tagConfig.groupNames.map((groupName: string) => ({
            groupName,
            tags: tagConfig.tags.filter((tag: TagName) => tag.groupName === groupName)
        }));
        const ungroupedTags: TagName[] = tagConfig.tags
            .filter((tag: TagName) => !tagConfig.groupNames.includes(tag.groupName));

        return ungroupedTags.length > 0
            ? [...tagGroups, { groupName: null, tags: ungroupedTags }]
            : tagGroups;
    }

    public static getImageTags(imageData: ImageData): string[] {
        return imageData.tags || [];
    }

    // The project tag list is the reference: a tag an image still carries while the list no longer
    // holds it (e.g. brought back by an undo after a rename) is neither shown nor exported.
    public static getActiveTagNames(imageData: ImageData, tagNames: string[]): string[] {
        const imageTags = new Set<string>(TagUtil.getImageTags(imageData));
        return tagNames.filter((tagName: string) => imageTags.has(tagName));
    }

    public static getTagFilterTokenId(tagName: string): string {
        return `${TAG_FILTER_TOKEN_PREFIX}${tagName}`;
    }

    public static isTagFilterTokenId(tokenId: string): boolean {
        return tokenId.startsWith(TAG_FILTER_TOKEN_PREFIX);
    }

    // Tag names come from user input and from JSON files: anything that is not a non-empty string
    // is dropped, names are trimmed and only the first occurrence of each one is kept.
    public static normalizeTagNames(tagNames: unknown): string[] {
        if (!Array.isArray(tagNames)) {
            return [];
        }

        const normalizedTagNames: string[] = [];
        tagNames.forEach((tagName: unknown) => {
            if (typeof tagName !== 'string') {
                return;
            }

            const normalizedTagName = tagName.trim();
            if (normalizedTagName.length > 0 && !normalizedTagNames.includes(normalizedTagName)) {
                normalizedTagNames.push(normalizedTagName);
            }
        });

        return normalizedTagNames;
    }

    public static mergeTagNames(...tagNamesLists: string[][]): string[] {
        return TagUtil.normalizeTagNames(
            tagNamesLists.flatMap((tagNames: string[]) => tagNames || [])
        );
    }

    public static toggleTag(tags: string[], tagName: string): string[] {
        return tags.includes(tagName)
            ? tags.filter((tag: string) => tag !== tagName)
            : tags.concat(tagName);
    }

    public static countTagInstances(imagesData: ImageData[], tagNames: string[]): number {
        const countedTagNames = new Set<string>(tagNames);
        return imagesData.reduce(
            (count: number, imageData: ImageData) =>
                count + TagUtil.getImageTags(imageData)
                    .filter((tag: string) => countedTagNames.has(tag))
                    .length,
            0
        );
    }

    // All the changes are applied in a single pass, so swapping two names, or deleting a tag and
    // giving its name to another one, cannot get mixed up halfway through.
    public static applyTagNameChanges(
        imagesData: ImageData[],
        changes: TagNameChanges
    ): ImageData[] {
        return imagesData.map((imageData: ImageData) => {
            const tags = TagUtil.getImageTags(imageData);
            if (!tags.some((tag: string) => changes.has(tag))) {
                return imageData;
            }

            return {
                ...imageData,
                tags: TagUtil.normalizeTagNames(
                    tags.map((tag: string) => changes.has(tag) ? changes.get(tag) : tag)
                ),
            };
        });
    }
}
