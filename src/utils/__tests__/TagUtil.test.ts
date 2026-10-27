import { ImageData, TagConfig, TagName } from '../../store/labels/types';
import { TagGroup, TagNameChanges, TagUtil } from '../TagUtil';
import { Settings } from '../../settings/Settings';

const createImageData = (id: string, tags?: string[]): ImageData => ({
    id,
    fileData: new File([''], `${id}.png`, { type: 'image/png' }),
    loadStatus: true,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    tags,
    imgWidth: 640,
    imgHeight: 480,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

describe('TagUtil normalizeTagNames method', () => {
    it('should trim names and drop empty, duplicated and non string values', () => {
        expect(TagUtil.normalizeTagNames([' Patho ', 'TGA', '', '  ', 'Patho', 42, null, 'Physio']))
            .toEqual(['Patho', 'TGA', 'Physio']);
    });

    it('should return an empty list for anything that is not a list', () => {
        expect(TagUtil.normalizeTagNames(undefined)).toEqual([]);
        expect(TagUtil.normalizeTagNames('Patho')).toEqual([]);
        expect(TagUtil.normalizeTagNames({ Patho: true })).toEqual([]);
    });
});

describe('TagUtil mergeTagNames method', () => {
    it('should keep the order of the first list and append the new names', () => {
        expect(TagUtil.mergeTagNames(['Physio', 'Patho'], ['TGA', 'Physio'], []))
            .toEqual(['Physio', 'Patho', 'TGA']);
    });
});

describe('TagUtil getActiveTagNames method', () => {
    it('should follow the tag list order and ignore the tags missing from it', () => {
        // given
        const imageData = createImageData('image-0', ['TGA', 'Removed', 'Physio']);

        // when
        const activeTagNames = TagUtil.getActiveTagNames(imageData, ['Physio', 'Patho', 'TGA']);

        // then
        expect(activeTagNames).toEqual(['Physio', 'TGA']);
    });

    it('should handle an image without any tag', () => {
        expect(TagUtil.getActiveTagNames(createImageData('image-0'), ['Physio'])).toEqual([]);
    });
});

describe('TagUtil toggleTag method', () => {
    it('should add a missing tag and remove a present one', () => {
        expect(TagUtil.toggleTag(['Physio'], 'TGA')).toEqual(['Physio', 'TGA']);
        expect(TagUtil.toggleTag(['Physio', 'TGA'], 'Physio')).toEqual(['TGA']);
    });
});

describe('TagUtil countTagInstances method', () => {
    it('should count every assignment of the given tags', () => {
        const imagesData = [
            createImageData('image-0', ['Physio', 'TGA']),
            createImageData('image-1', ['TGA']),
            createImageData('image-2'),
        ];

        expect(TagUtil.countTagInstances(imagesData, ['TGA', 'Physio'])).toEqual(3);
        expect(TagUtil.countTagInstances(imagesData, [])).toEqual(0);
    });
});

describe('TagUtil applyTagNameChanges method', () => {
    it('should rename and delete tags on every image', () => {
        // given
        const imagesData = [
            createImageData('image-0', ['Physio', 'TGA']),
            createImageData('image-1', ['TGA']),
        ];
        const changes: TagNameChanges = new Map<string, string | null>([
            ['Physio', 'Normal'],
            ['TGA', null],
        ]);

        // when
        const result = TagUtil.applyTagNameChanges(imagesData, changes);

        // then
        expect(result.map((imageData: ImageData) => imageData.tags)).toEqual([['Normal'], []]);
    });

    it('should swap two names without mixing them up', () => {
        // given
        const imagesData = [createImageData('image-0', ['A']), createImageData('image-1', ['B'])];
        const changes: TagNameChanges = new Map<string, string | null>([['A', 'B'], ['B', 'A']]);

        // when
        const result = TagUtil.applyTagNameChanges(imagesData, changes);

        // then
        expect(result.map((imageData: ImageData) => imageData.tags)).toEqual([['B'], ['A']]);
    });

    it('should give the name of a deleted tag to a renamed one', () => {
        // given
        const imagesData = [createImageData('image-0', ['A', 'B']), createImageData('image-1', ['B'])];
        const changes: TagNameChanges = new Map<string, string | null>([['A', 'B'], ['B', null]]);

        // when
        const result = TagUtil.applyTagNameChanges(imagesData, changes);

        // then
        expect(result.map((imageData: ImageData) => imageData.tags)).toEqual([['B'], []]);
    });

    it('should leave untouched the images without any changed tag', () => {
        const imageData = createImageData('image-0', ['Physio']);

        const result = TagUtil.applyTagNameChanges([imageData], new Map<string, string | null>([['TGA', null]]));

        expect(result[0]).toBe(imageData);
    });
});

describe('TagUtil filter token ids', () => {
    it('should tell tag tokens apart from class and group ones', () => {
        expect(TagUtil.isTagFilterTokenId(TagUtil.getTagFilterTokenId('Patho'))).toBe(true);
        expect(TagUtil.isTagFilterTokenId('Patho')).toBe(false);
        expect(TagUtil.isTagFilterTokenId('__image_group__:Patho')).toBe(false);
    });
});

describe('TagUtil createTagName method', () => {
    it('should give a new tag a color of the label palette', () => {
        const tagName: TagName = TagUtil.createTagName('Patho', 'Diagnostic');

        expect(tagName.name).toEqual('Patho');
        expect(tagName.groupName).toEqual('Diagnostic');
        expect(Settings.LABEL_COLORS_PALETTE).toContain(tagName.color);
        expect(TagUtil.createTagName('Doute')).not.toHaveProperty('groupName');
    });
});

describe('TagUtil createTagConfig method', () => {
    it('should sort the tags group by group, the ones without group last', () => {
        // given
        const tags: TagName[] = [
            { name: 'Doute', color: '#1' },
            { name: 'TGA', color: '#2', groupName: 'Cardiopathies' },
            { name: 'Physio', color: '#3', groupName: 'Diagnostic' },
            { name: 'Patho', color: '#4', groupName: 'Diagnostic' },
        ];

        // when
        const tagConfig: TagConfig = TagUtil.createTagConfig(tags, ['Diagnostic', 'Cardiopathies']);

        // then
        expect(TagUtil.getTagNames(tagConfig)).toEqual(['Physio', 'Patho', 'TGA', 'Doute']);
        expect(tagConfig.groupNames).toEqual(['Diagnostic', 'Cardiopathies']);
    });

    it('should take a tag out of a group that does not exist', () => {
        const tagConfig: TagConfig = TagUtil.createTagConfig(
            [{ name: 'Physio', color: '#1', groupName: 'Removed' }],
            [' Diagnostic ', '', 'Diagnostic']
        );

        expect(tagConfig).toEqual({ tags: [{ name: 'Physio', color: '#1' }], groupNames: ['Diagnostic'] });
    });
});

describe('TagUtil mergeTagConfigs method', () => {
    it('should keep the current tags as they are and append the new imported ones', () => {
        // given
        const currentTagConfig: TagConfig = {
            tags: [{ name: 'Physio', color: '#current', groupName: 'Diagnostic' }],
            groupNames: ['Diagnostic'],
        };
        const importedTagConfig: TagConfig = {
            tags: [
                { name: 'Physio', color: '#imported', groupName: 'Other' },
                { name: 'TGA', color: '#imported', groupName: 'Cardiopathies' },
            ],
            groupNames: ['Other', 'Cardiopathies'],
        };

        // when
        const tagConfig: TagConfig = TagUtil.mergeTagConfigs(currentTagConfig, importedTagConfig);

        // then
        expect(tagConfig).toEqual({
            tags: [
                { name: 'Physio', color: '#current', groupName: 'Diagnostic' },
                { name: 'TGA', color: '#imported', groupName: 'Cardiopathies' },
            ],
            groupNames: ['Diagnostic', 'Other', 'Cardiopathies'],
        });
    });
});

describe('TagUtil getTagGroups method', () => {
    it('should list every group, even an empty one, then the tags without group', () => {
        // given
        const tagConfig: TagConfig = {
            tags: [
                { name: 'Physio', color: '#1', groupName: 'Diagnostic' },
                { name: 'Doute', color: '#2' },
            ],
            groupNames: ['Diagnostic', 'Empty'],
        };

        // when
        const tagGroups: TagGroup[] = TagUtil.getTagGroups(tagConfig);

        // then
        expect(tagGroups.map((tagGroup: TagGroup) => [tagGroup.groupName, TagUtil.getTagNames({ ...tagConfig, tags: tagGroup.tags })]))
            .toEqual([['Diagnostic', ['Physio']], ['Empty', []], [null, ['Doute']]]);
    });

    it('should not add the tags without group when there are none', () => {
        const tagConfig: TagConfig = {
            tags: [{ name: 'Physio', color: '#1', groupName: 'Diagnostic' }],
            groupNames: ['Diagnostic'],
        };

        expect(TagUtil.getTagGroups(tagConfig)).toHaveLength(1);
    });
});
