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
import {ImageClassCriteria} from "../../../../store/general/types";

interface IProps {
    activeImageIndex: number;
    imagesData: ImageData[];
    activeLabelType: LabelType;
    filterMode: ImageFilterMode;
    searchText: string;
    imageClassCriteria: ImageClassCriteria[];
    updateImageListFilterModeAction: (filterMode: ImageFilterMode) => any;
    updateImageListSearchTextAction: (searchText: string) => any;
}

interface IState {
    size: ISize;
    key: number;
}

class ImagesList extends React.Component<IProps, IState> {
    private imagesListRef: HTMLDivElement;
    private controlsRef: HTMLDivElement;
    private lastFilteredIndices: number[];

    constructor(props) {
        super(props);

        this.state = {
            size: null,
            key: 0,
        }

        this.lastFilteredIndices = this.getFilteredImagesFromProps(props);
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
        const controlsHeight = this.controlsRef
            ? this.controlsRef.getBoundingClientRect().height
            : 0;
        this.setState({
            size: {
                width: listBoundingBox.width,
                height: Math.max(listBoundingBox.height - controlsHeight, 0)
            }
        })
    };

    private isImageChecked = (index:number): boolean => {
        const imageData = this.props.imagesData[index];
        return ImageFilterUtil.isImageLabeled(imageData, this.props.activeLabelType);
    };

    private getFilteredImagesFromProps = (props: IProps): number[] => {
        const {
            imagesData,
            activeLabelType,
            filterMode,
            searchText,
            imageClassCriteria,
        } = props;

        return ImageFilterUtil.getFilteredImageIndices(
            imagesData,
            activeLabelType,
            filterMode,
            searchText,
            imageClassCriteria
        );
    };

    private getFilteredImages = (): number[] => {
        return this.getFilteredImagesFromProps(this.props);
    };

    private onClickHandler = (index: number) => {
        ImageActions.getImageByIndex(index)
    };

    componentDidUpdate(prevProps: IProps) {
        const filterChanged =
            prevProps.activeLabelType !== this.props.activeLabelType ||
            prevProps.searchText !== this.props.searchText ||
            prevProps.filterMode !== this.props.filterMode ||
            prevProps.imageClassCriteria !== this.props.imageClassCriteria;

        const currentFilteredIndices = this.getFilteredImages();
        const filteredImagesChanged =
            this.lastFilteredIndices.length !== currentFilteredIndices.length ||
            this.lastFilteredIndices.some((value, index) => value !== currentFilteredIndices[index]);

        if (filterChanged || filteredImagesChanged) {
            ImageActions.syncActiveImageWithFilters();
            this.setState((state) => ({ key: state.key + 1 }));
            this.updateListSize();
        }

        this.lastFilteredIndices = currentFilteredIndices;
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
            <div className="ImagesListControls" ref={(ref) => this.controlsRef = ref}>
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
                        key={key}
                        size={size}
                        childSize={{width: 150, height: 150}}
                        childCount={filteredIndices.length}
                        childRender={this.renderImagePreview}
                        overScanHeight={200}
                        scrollToIndex={0}
                    />
                )}
                {filteredIndices.length === 0 && (
                    <div className="NoImagesFound">
                        No images match the current filters
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
    searchText: state.general.imageListSearchText,
    imageClassCriteria: state.general.imageClassCriteria,
});

export default connect(
    mapStateToProps,
    {
        updateImageListFilterModeAction: updateImageListFilterMode,
        updateImageListSearchTextAction: updateImageListSearchText,
    }
)(ImagesList);
