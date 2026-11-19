import { VirtualListUtil } from '../VirtualListUtil';

describe('VirtualListUtil.calculateAnchorPoints', () => {
    it('spreads the spare width evenly around the columns, the same on every row', () => {
        const anchors = VirtualListUtil.calculateAnchorPoints({ width: 180, height: 500 }, { width: 170, height: 140 }, 3);

        expect(anchors).toEqual([{ x: 5, y: 0 }, { x: 5, y: 140 }, { x: 5, y: 280 }]);
    });

    it('places several columns side by side', () => {
        const anchors = VirtualListUtil.calculateAnchorPoints({ width: 330, height: 500 }, { width: 100, height: 100 }, 4);

        expect(anchors.map((anchor) => anchor.x)).toEqual([7.5, 115, 222.5, 7.5]);
    });
});
