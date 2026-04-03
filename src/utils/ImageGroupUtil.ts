import { ImageData } from '../store/labels/types';

export const DEFAULT_IMAGE_GROUP_NAME = 'default_group';

const GROUP_FILTER_TOKEN_PREFIX = '__image_group__:';

export class ImageGroupUtil {
    public static normalizeGroupName(groupName?: string): string {
        const normalizedGroupName = (groupName || '').trim();

        return normalizedGroupName.length > 0
            ? normalizedGroupName
            : DEFAULT_IMAGE_GROUP_NAME;
    }

    public static getImageGroupName(imageData: ImageData): string {
        return ImageGroupUtil.normalizeGroupName(imageData.groupName);
    }

    public static getGroupFilterTokenId(groupName: string): string {
        return `${GROUP_FILTER_TOKEN_PREFIX}${ImageGroupUtil.normalizeGroupName(groupName)}`;
    }

    public static isGroupFilterTokenId(tokenId: string): boolean {
        return tokenId.startsWith(GROUP_FILTER_TOKEN_PREFIX);
    }

    public static getOrderedGroupNames(imagesData: ImageData[]): string[] {
        const orderedGroupNames: string[] = [];
        const seenGroupNames = new Set<string>();

        imagesData.forEach((imageData: ImageData) => {
            const groupName = ImageGroupUtil.getImageGroupName(imageData);

            if (!seenGroupNames.has(groupName)) {
                seenGroupNames.add(groupName);
                orderedGroupNames.push(groupName);
            }
        });

        return orderedGroupNames;
    }

    public static getFilterableGroupNames(imagesData: ImageData[]): string[] {
        const orderedGroupNames = ImageGroupUtil.getOrderedGroupNames(imagesData);

        if (
            orderedGroupNames.length === 1 &&
            orderedGroupNames[0] === DEFAULT_IMAGE_GROUP_NAME
        ) {
            return [];
        }

        return orderedGroupNames;
    }
}
