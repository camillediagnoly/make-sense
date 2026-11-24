import React from 'react';
import {ISize} from "../../../interfaces/ISize";
import {IRect} from "../../../interfaces/IRect";
import Scrollbars from 'react-custom-scrollbars-2';
import './VirtualList.scss';
import {VirtualListUtil} from "../../../utils/VirtualListUtil";
import {IPoint} from "../../../interfaces/IPoint";

interface IProps {
    size: ISize;
    childCount: number;
    childSize: ISize;
    childRender: (index: number, isScrolling: boolean, isVisible: boolean, style: React.CSSProperties) => any;
    overScanHeight?: number;
    scrollToIndex: number;
    // Optional sections: ascending child indices opening a new row under a full width header
    sectionStarts?: number[];
    sectionHeaderHeight?: number;
    sectionHeaderRender?: (sectionIndex: number, style: React.CSSProperties) => any;
}

interface IState {
    viewportRect: IRect;
    isScrolling: boolean;
}

const SCROLLBAR_WIDTH_PX = 10;
// The strip on the right kept free for the scrollbar, so it never covers a child
const SCROLLBAR_ROOM_PX = SCROLLBAR_WIDTH_PX + 4;

export class VirtualList extends React.Component<IProps, IState> {
    private static getLayoutSize(size: ISize): ISize {
        return size && {width: Math.max(size.width - SCROLLBAR_ROOM_PX, 0), height: size.height};
    }

    private gridSize: ISize;
    private contentSize: ISize;
    private childAnchors: IPoint[];
    private sectionHeaderTops: number[] = [];
    private scrollbars: Scrollbars;

    constructor(props) {
        super(props);
        this.state = {
            viewportRect: null,
            isScrolling: false
        };
    }

    private static areSameSections(sectionsA: number[] = [], sectionsB: number[] = []): boolean {
        return sectionsA.length === sectionsB.length &&
            sectionsA.every((start: number, index: number) => start === sectionsB[index]);
    }

    public componentDidMount(): void {
        const {size, childSize, childCount} = this.props;
        this.calculate(VirtualList.getLayoutSize(size), childSize, childCount, this.props);
        this.setState({
            viewportRect: {
                x: 0,
                y: 0,
                width: this.props.size.width,
                height: this.props.size.height
            }
        }, this.scrollToRequestedIndex);
    }

    public componentWillUpdate(nextProps: Readonly<IProps>, nextState: Readonly<IState>, nextContext: any): void {
        const {size, childSize, childCount} = nextProps;
        if (this.props.size.height !== size.height || this.props.size.width !== size.width ||
            this.props.childCount !== childCount ||
            this.props.sectionHeaderHeight !== nextProps.sectionHeaderHeight ||
            !VirtualList.areSameSections(this.props.sectionStarts, nextProps.sectionStarts)) {
            this.calculate(VirtualList.getLayoutSize(size), childSize, childCount, nextProps);
            this.setState({
                viewportRect: {
                    x: this.scrollbars.getValues().scrollLeft,
                    y: this.scrollbars.getValues().scrollTop,
                    width: size.width,
                    height: size.height
                }
            });
        }
    }

    private calculate = (size: ISize, childSize: ISize, childCount: number, props: Readonly<IProps>) => {
        this.gridSize = VirtualListUtil.calculateGridSize(size, childSize, childCount);
        const {sectionStarts, sectionHeaderHeight} = props;
        if (sectionStarts && sectionStarts.length > 0) {
            const layout = VirtualListUtil.calculateSectionedLayout(
                size, childSize, childCount, sectionStarts, sectionHeaderHeight || 0
            );
            this.contentSize = layout.contentSize;
            this.childAnchors = layout.childAnchors;
            this.sectionHeaderTops = layout.sectionHeaderTops;
        } else {
            this.contentSize = VirtualListUtil.calculateContentSize(size, childSize, this.gridSize);
            this.childAnchors = VirtualListUtil.calculateAnchorPoints(size, childSize, childCount);
            this.sectionHeaderTops = [];
        }
    };

    private scrollToRequestedIndex = () => {
        const {scrollToIndex} = this.props;
        const anchor = this.childAnchors && this.childAnchors[scrollToIndex];

        if (!this.scrollbars || !anchor) {
            return;
        }

        // A child opening a section is scrolled to along with its header
        const sectionIndex = this.sectionHeaderTops.length > 0
            ? (this.props.sectionStarts || []).indexOf(scrollToIndex)
            : -1;
        this.scrollbars.scrollTop(sectionIndex !== -1
            ? this.sectionHeaderTops[sectionIndex]
            : anchor.y);
    };

    private getVirtualListStyle = ():React.CSSProperties => {
        return {
            position: "relative",
            width: this.props.size.width,
            height: this.props.size.height,
        }
    };

    private getVirtualListContentStyle = ():React.CSSProperties => {
        return {
            width: this.contentSize.width,
            height: this.contentSize.height,
        }
    };

    private onScrollStart = () => {
        this.setState({isScrolling: true});
    };

    private onScrollStop = () => {
        this.setState({isScrolling: false});
    };

    private onScroll = (values) => {
        this.setState({
            viewportRect: {
                x: values.scrollLeft,
                y: values.scrollTop,
                width: this.props.size.width,
                height: this.props.size.height
            }
        });
    };

    private getChildren = () => {
        const {viewportRect, isScrolling} = this.state;
        const {overScanHeight, childSize} = this.props;
        const overScan: number = !!overScanHeight ? overScanHeight : 0;

        const viewportRectWithOverScan:IRect = {
            x: viewportRect.x,
            y: viewportRect.y - overScan,
            width: viewportRect.width,
            height: viewportRect.height + 2 * overScan
        };

        const viewportTop: number = viewportRectWithOverScan.y;
        const viewportBottom: number = viewportRectWithOverScan.y + viewportRectWithOverScan.height;
        const children = [];

        const {sectionHeaderRender} = this.props;
        const sectionHeaderHeight: number = this.props.sectionHeaderHeight || 0;
        if (sectionHeaderRender) {
            const headerRange = VirtualListUtil.findVisibleRange(
                this.sectionHeaderTops.length,
                (sectionIndex: number) => this.sectionHeaderTops[sectionIndex],
                sectionHeaderHeight,
                viewportTop,
                viewportBottom
            );
            for (let sectionIndex = headerRange.first; sectionIndex < headerRange.end; sectionIndex++) {
                children.push(sectionHeaderRender(sectionIndex, {
                    position: "absolute",
                    left: 0,
                    top: this.sectionHeaderTops[sectionIndex],
                    width: this.contentSize.width,
                    height: sectionHeaderHeight
                }));
            }
        }

        const childRange = VirtualListUtil.findVisibleRange(
            this.childAnchors.length,
            (index: number) => this.childAnchors[index].y,
            childSize.height,
            viewportTop,
            viewportBottom
        );
        for (let index = childRange.first; index < childRange.end; index++) {
            const anchor: IPoint = this.childAnchors[index];
            children.push(this.props.childRender(index, isScrolling, true, {
                position: "absolute",
                left: anchor.x,
                top: anchor.y,
                width: childSize.width,
                height: childSize.height
            }));
        }
        return children;
    };

    public render() {
        const displayContent = !!this.props.size && !!this.props.childSize && !!this.gridSize;

        return(
            <div
                className="VirtualList"
                style={this.getVirtualListStyle()}
            >
                <Scrollbars
                    ref={ref => this.scrollbars = ref}
                    onScrollFrame={this.onScroll}
                    onScrollStart={this.onScrollStart}
                    onScrollStop={this.onScrollStop}
                    // Always shown and easy to grab: a thin bar fading away is easily missed
                    autoHide={false}
                    renderTrackVertical={({style, ...props}) => <div
                        {...props}
                        className="VirtualListTrack"
                        style={{...style, width: SCROLLBAR_WIDTH_PX, right: 2, top: 2, bottom: 2}}
                    />}
                    renderThumbVertical={({style, ...props}) => <div
                        {...props}
                        className="VirtualListThumb"
                        style={style}
                    />}
                >
                    {displayContent && <div
                        className="VirtualListContent"
                        style={this.getVirtualListContentStyle()}
                    >
                        {this.getChildren()}
                    </div>}
                </Scrollbars>
            </div>
        )
    }
}
