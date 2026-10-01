import { generalReducer } from './reducer';
import { updateImageClassCriteria, updateImageClassCriteriaLock } from './actionCreators';

describe('generalReducer image class criteria lock', () => {
    it('should release the lock when another expression gets applied', () => {
        const lockedState = generalReducer(
            undefined,
            updateImageClassCriteriaLock(true, ['image-0'])
        );
        expect(lockedState.imageClassCriteriaLocked).toBe(true);
        expect(lockedState.lockedImageClassCriteriaImageIds).toEqual(['image-0']);

        const nextState = generalReducer(
            lockedState,
            updateImageClassCriteria([{ type: 'label', labelId: 'B' }])
        );
        expect(nextState.imageClassCriteriaLocked).toBe(false);
        expect(nextState.lockedImageClassCriteriaImageIds).toEqual([]);
    });
});
