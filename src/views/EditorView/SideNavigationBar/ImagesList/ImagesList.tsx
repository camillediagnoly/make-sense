import React from 'react';
import {connect} from "react-redux";
import {LabelType} from "../../../../data/enums/LabelType";
import {ISize} from "../../../../interfaces/ISize";
import {AppState} from "../../../../store";
import {ImageData} from "../../../../store/labels/types";
import {VirtualList} from "../../../Common/VirtualList/VirtualList";
import ImagePreview from "../ImagePreview/ImagePreview";
import './ImagesList.scss';
import {ContextManager} from "../../../../logic/context/ContextManager";
import {ContextType} from "../../../../data/enums/ContextType";
import {ImageActions} from "../../../../logic/actions/ImageActions";
import {EventType} from "../../../../data/enums/EventType";
import {ImageFilterMode} from "../../../../data/enums/ImageFilterMode";
import {ImageFilterUtil} from "../../../../utils/ImageFilterUtil";
import {updateImageListFilterMode, updateImageListSearchText} from "../../../../store/general/actionCreators";

interface IProps {
    activeImageIndex: number;
    imagesData: ImageData[];
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    updateImageListFilterModeAction: (filterMode: ImageFilterMode) => any;
    updateImageListSearchTextAction: (searchText: string) => any;
}

interface IState {
    size: ISize;
    key: number; // Used to force refresh the VirtualList
}

class ImagesList extends React.Component<IProps, IState> {
    private imagesListRef: HTMLDivElement;

    constructor(props) {
        super(props);

        this.state = {
            size: null,
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
        const imageData = this.props.imagesData[index];
        return ImageFilterUtil.isImageLabeled(imageData, this.props.activeLabelType);
    };

    private getFilteredImages = (): number[] => {
        const { imagesData, activeLabelType, filterMode, searchText } = this.props;
        return ImageFilterUtil.getFilteredImageIndices(
            imagesData,
            activeLabelType,
            filterMode,
            searchText
        );
    };

    private onClickHandler = (index: number) => {
        ImageActions.getImageByIndex(index)
    };

    // Force VirtualList to re-render and reset its scroll position when filters change
    componentDidUpdate(prevProps) {
        if (prevProps.searchText !== this.props.searchText ||
            prevProps.filterMode !== this.props.filterMode) {
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
        this.props.updateImageListSearchTextAction(e.target.value);
    };

    private setFilterMode = (filterMode: ImageFilterMode) => {
        this.props.updateImageListFilterModeAction(filterMode);
    };

    private renderSearchAndFilter = () => {
        const { filterMode, searchText } = this.props;
        return (
            <div className="ImagesListControls">
                <div className="SearchContainer">
                    <input 
                        type="text" 
                        className="SearchInput"
                        placeholder="Search images by name..."
                        value={searchText}
                        onChange={this.handleSearchChange}
                    />
                </div>
                <div className="FilterButtons">
                    <button 
                        className={`FilterButton ${filterMode === ImageFilterMode.ALL ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(ImageFilterMode.ALL)}
                    >
                        All
                    </button>
                    <button 
                        className={`FilterButton ${filterMode === ImageFilterMode.LABELED ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(ImageFilterMode.LABELED)}
                    >
                        Labeled
                    </button>
                    <button 
                        className={`FilterButton ${filterMode === ImageFilterMode.UNLABELED ? 'active' : ''}`}
                        onClick={() => this.setFilterMode(ImageFilterMode.UNLABELED)}
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

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    activeLabelType: state.labels.activeLabelType,
    filterMode: state.general.imageListFilterMode,
    searchText: state.general.imageListSearchText
});

export default connect(
    mapStateToProps,
    {
        updateImageListFilterModeAction: updateImageListFilterMode,
        updateImageListSearchTextAction: updateImageListSearchText
    }
)(ImagesList);
