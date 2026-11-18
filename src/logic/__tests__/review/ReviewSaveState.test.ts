import { ReviewSaveState } from '../../review/ReviewSaveState';
import { ImageData, LabelRect } from '../../../store/labels/types';
import { ImageDataUtil } from '../../../utils/ImageDataUtil';
import { LabelStatus } from '../../../data/enums/LabelStatus';

const labelRect = (id: string, x: number): LabelRect => ({
    id, labelId: 'head', isVisible: true, rect: { x, y: 0, width: 10, height: 10 },
    isCreatedByAI: false, status: LabelStatus.ACCEPTED, suggestedLabel: null,
});

const image = (id: string, rects: LabelRect[]): ImageData => ({
    ...ImageDataUtil.createImageDataFromFileData(new File(['x'], `${id}.png`), id),
    labelRects: rects,
});

describe('ReviewSaveState', () => {
    afterEach(() => ReviewSaveState.clear());

    it('has no unsaved changes right after loading', () => {
        const imagesData = [image('a', [labelRect('r1', 0)])];
        ReviewSaveState.markLoaded(imagesData);

        expect(ReviewSaveState.hasUnsavedChanges(imagesData)).toBe(false);
        expect(ReviewSaveState.getLastSavedAt()).toBeNull();
    });

    it('sees a moved or deleted annotation as unsaved, until saved', () => {
        const loaded = [image('a', [labelRect('r1', 0)])];
        ReviewSaveState.markLoaded(loaded);

        const moved = [{ ...loaded[0], labelRects: [labelRect('r1', 5)] }];
        const deleted = [{ ...loaded[0], labelRects: [{ ...labelRect('r1', 0), isDeleted: true }] }];
        expect(ReviewSaveState.hasUnsavedChanges(moved)).toBe(true);
        expect(ReviewSaveState.hasUnsavedChanges(deleted)).toBe(true);

        ReviewSaveState.markSaved(moved);
        expect(ReviewSaveState.hasUnsavedChanges(moved)).toBe(false);
        expect(ReviewSaveState.getLastSavedAt()).toBeInstanceOf(Date);
    });

    it('ignores what is not saved: visibility and images seen', () => {
        const loaded = [image('a', [labelRect('r1', 0)])];
        ReviewSaveState.markLoaded(loaded);

        const changed = [{
            ...loaded[0],
            isSeen: true,
            labelRects: [{ ...labelRect('r1', 0), isVisible: false }],
        }];
        expect(ReviewSaveState.hasUnsavedChanges(changed)).toBe(false);
    });

    it('tells its listeners when saved', () => {
        const listener = jest.fn();
        const unsubscribe = ReviewSaveState.subscribe(listener);
        ReviewSaveState.markSaved([]);
        unsubscribe();
        ReviewSaveState.markSaved([]);

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
