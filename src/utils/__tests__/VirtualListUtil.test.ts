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

describe('VirtualListUtil.calculateSectionedLayout', () => {
    const listSize = { width: 330, height: 500 };
    const childSize = { width: 100, height: 100 };

    it('matches the plain grid without sections', () => {
        const layout = VirtualListUtil.calculateSectionedLayout(listSize, childSize, 4, [], 20);

        expect(layout.childAnchors).toEqual(VirtualListUtil.calculateAnchorPoints(listSize, childSize, 4));
        expect(layout.sectionHeaderTops).toEqual([]);
        expect(layout.contentSize).toEqual({ width: 330, height: 200 });
    });

    it('opens a new row under a header for each section', () => {
        // 3 columns: section A holds children 0-3, section B children 4-5
        const layout = VirtualListUtil.calculateSectionedLayout(listSize, childSize, 6, [0, 4], 20);

        expect(layout.sectionHeaderTops).toEqual([0, 220]);
        expect(layout.childAnchors.map((anchor) => anchor.y)).toEqual([20, 20, 20, 120, 240, 240]);
        expect(layout.childAnchors.map((anchor) => anchor.x)).toEqual([7.5, 115, 222.5, 7.5, 7.5, 115]);
        expect(layout.contentSize).toEqual({ width: 330, height: 340 });
    });
});

describe('VirtualListUtil.findVisibleRange', () => {
    // rows of height 100 starting at 0, 0, 100, 100, 200, 200, 300
    const tops = [0, 0, 100, 100, 200, 200, 300];
    const range = (viewportTop: number, viewportBottom: number) =>
        VirtualListUtil.findVisibleRange(tops.length, (index) => tops[index], 100, viewportTop, viewportBottom);

    it('keeps every item intersecting the viewport, edges included', () => {
        expect(range(150, 250)).toEqual({ first: 2, end: 6 });
        expect(range(100, 100)).toEqual({ first: 0, end: 4 });
        expect(range(-50, 1000)).toEqual({ first: 0, end: 7 });
    });

    it('is empty past the last item and for an empty list', () => {
        expect(range(500, 600)).toEqual({ first: 7, end: 7 });
        expect(VirtualListUtil.findVisibleRange(0, () => 0, 100, 0, 100)).toEqual({ first: 0, end: 0 });
    });
});
