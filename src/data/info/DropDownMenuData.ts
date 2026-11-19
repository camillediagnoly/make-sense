import {updateActivePopupType} from '../../store/general/actionCreators';
import {PopupWindowType} from '../enums/PopupWindowType';
import {store} from '../../index';

export type DropDownMenuNode = {
    name: string
    description?: string
    imageSrc: string
    imageAlt: string
    disabled: boolean
    onClick?: () => void
    children?: DropDownMenuNode[]
}

export const DropDownMenuData: DropDownMenuNode[] = [
    {
        name: 'Actions',
        imageSrc: 'ico/actions.png',
        imageAlt: 'actions',
        disabled: false,
        children: [
            {
                name: 'Edit Labels',
                description: 'Modify labels list',
                imageSrc: 'ico/tags.png',
                imageAlt: 'labels',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.UPDATE_LABEL))
            },
            {
                name: 'Edit Tags',
                description: 'Modify image tags list',
                imageSrc: 'ico/labels.png',
                imageAlt: 'tags',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.EDIT_TAGS))
            },
            {
                name: 'Edit Shortcuts',
                imageSrc: 'ico/keyboard.png',
                imageAlt: 'keyboard',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.EDIT_SHORTCUTS))
            },
            {
                name: 'Import Images',
                description: 'Load more images',
                imageSrc: 'ico/camera.png',
                imageAlt: 'images',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMPORT_IMAGES))
            },
            {
                name: 'Backup Settings',
                description: 'Automatic backups of the annotations',
                imageSrc: 'ico/gears.png',
                imageAlt: 'backup-settings',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.BACKUP_SETTINGS))
            },
            {
                name: 'Labels Filter',
                description: 'Filter images by label criteria',
                imageSrc: 'ico/filter.svg',
                imageAlt: 'labels-filter',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.IMAGE_CLASS_FILTER))
            },
            {
                name: 'Edit Keypoints',
                description: 'Configure measurement keypoint functions',
                imageSrc: 'ico/keypoint-line.svg',
                imageAlt: 'edit-keypoints',
                disabled: false,
                onClick: () => store.dispatch(updateActivePopupType(PopupWindowType.EDIT_KEYPOINTS))
            },
        ]
    }
]
