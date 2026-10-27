import { LabelsSelector } from '../../store/selectors/LabelsSelector';
import { GeneralSelector } from '../../store/selectors/GeneralSelector';
import { ImageData, TagConfig } from '../../store/labels/types';
import { store } from '../../index';
import {
    updateImageData,
    updateImageDataById,
    updateTagConfig
} from '../../store/labels/actionCreators';
import {
    updateImageClassCriteria,
    updateImageClassCriteriaLock
} from '../../store/general/actionCreators';
import { ImageClassCriteria } from '../../store/general/types';
import { ImageFilterUtil } from '../../utils/ImageFilterUtil';
import { TagNameChanges, TagUtil } from '../../utils/TagUtil';

export class TagActions {
    public static toggleTagOnActiveImage(tagName: string) {
        const activeImageData: ImageData | null = LabelsSelector.getActiveImageData();
        if (!activeImageData) {
            return;
        }

        store.dispatch(updateImageDataById(activeImageData.id, {
            ...activeImageData,
            tags: TagUtil.toggleTag(TagUtil.getImageTags(activeImageData), tagName)
        }));
    }

    public static toggleTagByIndexOnActiveImage(index: number) {
        const tagName: string | undefined = LabelsSelector.getTagNames()[index];
        if (tagName) {
            TagActions.toggleTagOnActiveImage(tagName);
        }
    }

    // The images, the tag config and the filter expression are updated together, so nothing keeps
    // pointing at a tag that has just been renamed or deleted.
    public static applyTagConfigChanges(tagConfig: TagConfig, changes: TagNameChanges) {
        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        if (TagUtil.countTagInstances(imagesData, Array.from(changes.keys())) > 0) {
            store.dispatch(updateImageData(TagUtil.applyTagNameChanges(imagesData, changes)));
        }
        store.dispatch(updateTagConfig(tagConfig));
        TagActions.applyTagNameChangesToImageClassCriteria(changes);
    }

    private static applyTagNameChangesToImageClassCriteria(changes: TagNameChanges) {
        const tokenIdRemap = new Map<string, string | null>();
        changes.forEach((newTagName: string | null, tagName: string) => {
            tokenIdRemap.set(
                TagUtil.getTagFilterTokenId(tagName),
                newTagName === null ? null : TagUtil.getTagFilterTokenId(newTagName)
            );
        });

        const imageClassCriteria: ImageClassCriteria[] = GeneralSelector.getImageClassCriteria();
        const remappedCriteria = ImageFilterUtil.remapLabelsInImageClassCriteria(
            imageClassCriteria,
            tokenIdRemap
        );
        if (remappedCriteria === null) {
            return;
        }

        // Any new expression releases the lock, but a rename leaves the matching images unchanged:
        // the frozen result is kept as long as no criterion got dropped.
        const wasLocked: boolean = GeneralSelector.getImageClassCriteriaLocked();
        const lockedImageIds: string[] = GeneralSelector.getLockedImageClassCriteriaImageIds();
        const isRenameOnly: boolean = remappedCriteria.length ===
            ImageFilterUtil.normalizeImageClassCriteria(imageClassCriteria).length;

        store.dispatch(updateImageClassCriteria(remappedCriteria));
        if (wasLocked && isRenameOnly) {
            store.dispatch(updateImageClassCriteriaLock(true, lockedImageIds));
        }
    }
}
