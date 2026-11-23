import {ISize} from "../interfaces/ISize";
import {IPoint} from "../interfaces/IPoint";

export interface IVirtualListLayout {
    childAnchors: IPoint[];
    // Top of each section header; a header spans the whole content width
    sectionHeaderTops: number[];
    contentSize: ISize;
}

export class VirtualListUtil {
    public static calculateGridSize(listSize: ISize, childSize: ISize, childCount: number): ISize {
        const columnCount: number = Math.floor(listSize.width / childSize.width);
        const rowCount: number = Math.ceil(childCount / columnCount);
        return {width: columnCount, height: rowCount};
    }

    public static calculateContentSize(listSize: ISize, childSize: ISize, gridSize: ISize): ISize {
        const sizeFromGrid:ISize = {
            width: childSize.width * gridSize.width,
            height: childSize.height * gridSize.height
        };

        return {
            width: Math.max(listSize.width, sizeFromGrid.width),
            height: sizeFromGrid.height
        }
    }

    public static calculateAnchorPoints(listSize: ISize, childSize: ISize, childCount: number): IPoint[] {
        const gridSize: ISize = VirtualListUtil.calculateGridSize(listSize, childSize, childCount);
        const contentWrapperSize: ISize = VirtualListUtil.calculateContentSize(listSize, childSize, gridSize);
        const horizontalMargin = (contentWrapperSize.width - gridSize.width * childSize.width) / (gridSize.width + 1);

        const anchors = [];
        for (let i = 0; i < childCount; i++) {
            const rowCount: number = Math.floor(i / gridSize.width);
            const columnCount: number = i % gridSize.width;

            const anchor: IPoint = {
                x: horizontalMargin + columnCount * (childSize.width + horizontalMargin),
                y: rowCount * childSize.height
            };
            anchors.push(anchor);
        }
        return anchors;
    }

    // The grid of calculateAnchorPoints, cut into sections: the children listed in sectionStarts
    // (ascending child indices) open a new row, right under a header of sectionHeaderHeight.
    public static calculateSectionedLayout(
        listSize: ISize,
        childSize: ISize,
        childCount: number,
        sectionStarts: number[],
        sectionHeaderHeight: number
    ): IVirtualListLayout {
        const columnCount: number = Math.max(Math.floor(listSize.width / childSize.width), 1);
        const contentWidth: number = Math.max(listSize.width, columnCount * childSize.width);
        const horizontalMargin = (contentWidth - columnCount * childSize.width) / (columnCount + 1);
        const sectionStartSet = new Set<number>(sectionStarts);

        const childAnchors: IPoint[] = [];
        const sectionHeaderTops: number[] = [];
        let rowTop: number = 0;
        let column: number = 0;
        for (let i = 0; i < childCount; i++) {
            if (sectionStartSet.has(i)) {
                if (column > 0) {
                    rowTop += childSize.height;
                    column = 0;
                }
                sectionHeaderTops.push(rowTop);
                rowTop += sectionHeaderHeight;
            } else if (column === columnCount) {
                rowTop += childSize.height;
                column = 0;
            }

            childAnchors.push({
                x: horizontalMargin + column * (childSize.width + horizontalMargin),
                y: rowTop
            });
            column += 1;
        }

        return {
            childAnchors,
            sectionHeaderTops,
            contentSize: {
                width: contentWidth,
                height: column > 0 ? rowTop + childSize.height : rowTop
            }
        };
    }
}
