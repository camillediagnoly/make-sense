import React from 'react';
import {connect} from "react-redux";
import {LabelType} from "../../../../data/enums/LabelType";
import {ISize} from "../../../../interfaces/ISize";
import {AppState} from "../../../../store";
import {ImageData, LabelPoint, LabelRect} from "../../../../store/labels/types";
import {VirtualList} from "../../../Common/VirtualList/VirtualList";
import ImagePreview from "../ImagePreview/ImagePreview";
import './ImagesList.scss';
import {ContextManager} from "../../../../logic/context/ContextManager";
import {ContextType} from "../../../../data/enums/ContextType";
import {ImageActions} from "../../../../logic/actions/ImageActions";
import {EventType} from "../../../../data/enums/EventType";
import {LabelStatus} from "../../../../data/enums/LabelStatus";

interface IProps {
    activeImageIndex: number;
    imagesData: ImageData[];
    activeLabelType: LabelType;
}

interface IState {
    size: ISize;
    searchText: string;
    filterMode: FilterMode;
    key: number; // Used to force refresh the VirtualList
}

enum FilterMode {
    ALL = "ALL",
    LABELED = "LABELED",
    UNLABELED = "UNLABELED"
}

class ImagesList extends React.Component<IProps, IState> {
    private imagesListRef: HTMLDivElement;

    constructor(props) {
        super(props);

        this.state = {
            size: null,
            searchText: "",
            filterMode: FilterMode.ALL,
            key: 0
        }
    }

    public componentDidMount(): void {
        this.updateListSize();
        window.addEventListener(EventType.RESIZE, this.updateListSize);
    }

    public componentWillUnmount(): void {
        window.removeEventListener(EventType.RESIZE, this.updateListSize);
    }

    private updateListSize = () => {
        if (!this.imagesListRef)
            return;

        const listBoundingBox = this.imagesListRef.getBoundingClientRect();
        this.setState({
            size: {
                width: listBoundingBox.width,
                height: listBoundingBox.height - 80 // Adjust height to account for search and filter controls
            }
        })
    };

    private isImageChecked = (index:number): boolean => {
        const imageData = this.props.imagesData[index]
        switch (this.props.activeLabelType) {
            case LabelType.LINE:
                return imageData.labelLines.length > 0
            case LabelType.IMAGE_RECOGNITION:
                return imageData.labelNameIds.length > 0
            case LabelType.POINT:
                return imageData.labelPoints
                    .filter((labelPoint: LabelPoint) => labelPoint.status === LabelStatus.ACCEPTED)
                    .length > 0
            case LabelType.POLYGON:
                return imageData.labelPolygons.length > 0
            case LabelType.RECT:
                return imageData.labelRects
                    .filter((labelRect: LabelRect) => labelRect.status === LabelStatus.ACCEPTED)
                    .length > 0
            default:
                return false;
        }
    };

    private getFilteredImages = (): number[] => {
        const { imagesData } = this.props;
        const { searchText, filterMode } = this.state;
        
        return imagesData
            .map((image, index) => ({ image, index }))
            .filter(({ image, index }) => {
                const filename = 
                    (image.fileData && image.fileData.name) 
                
                const matchesSearch = searchText === "" || 
                    filename.toLowerCase().includes(searchText.toLowerCase());
                
                
                let matchesFilter = true;
                if (filterMode === FilterMode.LABELED) {
                    matchesFilter = this.isImageChecked(index);
                } else if (filterMode === FilterMode.UNLABELED) {
                    matchesFilter = !this.isImageChecked(index);
                }
                
                return matchesSearch && matchesFilter;
            })
            .map(({ index }) => index);
    };

    private onClickHandler = (index: number) => {
        ImageActions.getImageByIndex(index)
    };

    // Force VirtualList to re-render and reset its scroll position when filters change
    componentDidUpdate(prevProps, prevState) {
        if (prevState.searchText !== this.state.searchText || 
            prevState.filterMode !== this.state.filterMode) {
            // Increment key to force VirtualList to completely re-render
            this.setState(prevState => ({ key: prevState.key + 1 }));
        }
    }

    private renderImagePreview = (index: number, isScrolling: boolean, isVisible: boolean, style: React.CSSProperties) => {
        const filteredIndices = this.getFilteredImages();
        const actualIndex = filteredIndices[index];
        
        return <ImagePreview
            key={actualIndex}
            style={style}
            size={{width: 150, height: 150}}
            isScrolling={isScrolling}
            isChecked={this.isImageChecked(actualIndex)}
            imageData={this.props.imagesData[actualIndex]}
            onClick={() => this.onClickHandler(actualIndex)}
            isSelected={this.props.activeImageIndex === actualIndex}
        />
    };

    private handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ searchText: e.target.value });
    };

    private setFilterMode = (filterMode: FilterMode) => {
        this.setState({ filterMode });
    };

    private renderSearchAndFilter = () => {
        const { filterMode } = this.state;
        return (
            <div className="ImagesListControls">
                <div className="SearchContainer">
                    <input 
                        type="text" 
                        className="SearchInput"
                        placeholder="Search images by name..."
                        value={this.state.searchText}
                        onChange={this.handleSearchChange}
                    />
                </div>
                <div className="FilterButtons">
                    <button 
                        className={`FilterButton ${filterMode === FilterMode.ALL ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(FilterMode.ALL)}
                    >
                        All
                    </button>
                    <button 
                        className={`FilterButton ${filterMode === FilterMode.LABELED ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(FilterMode.LABELED)}
                    >
                        Labeled
                    </button>
                    <button 
                        className={`FilterButton ${filterMode === FilterMode.UNLABELED ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(FilterMode.UNLABELED)}
                    >
                        Unlabeled
                    </button>
                </div>
            </div>
        );
    };

    public render() {
        const { size, key } = this.state;
        const filteredIndices = this.getFilteredImages();
        
        return(
            <div
                className="ImagesList"
                ref={ref => this.imagesListRef = ref}
                onClick={() => ContextManager.switchCtx(ContextType.LEFT_NAVBAR)}
            >
                {this.renderSearchAndFilter()}
                {size && filteredIndices.length > 0 && (
                    <VirtualList
                        key={key} // Force complete re-render when filters change
                        size={size}
                        childSize={{width: 150, height: 150}}
                        childCount={filteredIndices.length}
                        childRender={this.renderImagePreview}
                        overScanHeight={200}
                        scrollToIndex={0} // Always reset scroll position
                    />
                )}
                {filteredIndices.length === 0 && (
                    <div className="NoImagesFound">
                        No images match your search criteria
                    </div>
                )}
            </div>
        )
    }
}

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    activeLabelType: state.labels.activeLabelType
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImagesList);
