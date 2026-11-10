import React, {useEffect, useRef, useState} from "react";
import './LabelsToolkit.scss';
import {ImageData, LabelName, LabelPolygon, LabelRect} from "../../../../store/labels/types";
import {updateActiveLabelId} from "../../../../store/labels/actionCreators";
import {AppState} from "../../../../store";
import {connect} from "react-redux";
import {ISize} from "../../../../interfaces/ISize";
import {Settings} from "../../../../settings/Settings";
import Scrollbars from "react-custom-scrollbars-2";
import {findLast} from "lodash";
import {ContextManager} from "../../../../logic/context/ContextManager";
import {ContextType} from "../../../../data/enums/ContextType";
import {EventType} from "../../../../data/enums/EventType";
import {LabelActions} from "../../../../logic/actions/LabelActions";
import LabelInputField from "../LabelInputField/LabelInputField";
import EmptyLabelList from "../EmptyLabelList/EmptyLabelList";
import {ReviewActions} from "../../../../logic/review/ReviewActions";

const LABEL_INPUT_FIELD_HEIGHT = 40;

interface IProps {
    activeImageIndex: number | null;
    imagesData: ImageData[];
    labelNames: LabelName[];
    activeLabelId: string;
    highlightedLabelId: string;
    updateActiveLabelIdAction: (activeLabelId: string) => any;
}

type ListedAnnotation = {
    id: string;
    labelId: string | null;
    isVisible: boolean;
    isDeleted: boolean;
};

const HINT_HEIGHT = 48;
const DELETED_HEADER_HEIGHT = 34;

// The single list of the review mode: every rectangle and polygon of the active image, which can
// be selected or hidden, but neither deleted nor renamed.
const LabelsToolkit: React.FC<IProps> = (
    {
        activeImageIndex,
        imagesData,
        labelNames,
        activeLabelId,
        highlightedLabelId,
        updateActiveLabelIdAction
    }
) => {
    const toolkitRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<ISize | null>(null);
    const activeImageData: ImageData | null = activeImageIndex === null ? null : imagesData[activeImageIndex];

    useEffect(() => {
        const updateSize = () => {
            if (toolkitRef.current) {
                const {width, height} = toolkitRef.current.getBoundingClientRect();
                setSize({width, height});
            }
        };
        updateSize();
        window.addEventListener(EventType.RESIZE, updateSize);
        return () => window.removeEventListener(EventType.RESIZE, updateSize);
    }, []);

    const getAnnotations = (): ListedAnnotation[] => {
        if (!activeImageData) {
            return [];
        }
        return [
            ...activeImageData.labelRects.map((labelRect: LabelRect) => ({
                id: labelRect.id, labelId: labelRect.labelId, isVisible: labelRect.isVisible,
                isDeleted: !!labelRect.isDeleted
            })),
            ...activeImageData.labelPolygons.map((labelPolygon: LabelPolygon) => ({
                id: labelPolygon.id, labelId: labelPolygon.labelId, isVisible: labelPolygon.isVisible,
                isDeleted: !!labelPolygon.isDeleted
            })),
        ];
    };

    const getLabelName = (annotation: ListedAnnotation): LabelName | null =>
        annotation.labelId !== null ? findLast(labelNames, {id: annotation.labelId}) : null;

    const renderDeletedRow = (annotation: ListedAnnotation, width: number) => {
        const labelName = getLabelName(annotation);
        return <div
            key={annotation.id}
            className='DeletedAnnotation'
            style={{width, height: LABEL_INPUT_FIELD_HEIGHT}}
            title='Click to re-add this annotation'
            onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                ReviewActions.setAnnotationDeleted(annotation.id, false);
            }}
        >
            <div className='Marker' style={labelName ? {backgroundColor: labelName.color} : {}}/>
            <div className='Name'>{labelName ? labelName.name : 'no label'}</div>
            <img draggable={false} src={'ico/plus.png'} alt={'re-add'}/>
        </div>;
    };

    const renderList = () => {
        const annotations = getAnnotations();
        const shownAnnotations = annotations.filter((annotation: ListedAnnotation) => !annotation.isDeleted);
        const deletedAnnotations = annotations.filter((annotation: ListedAnnotation) => annotation.isDeleted);
        const listSize: ISize = {
            width: size.width - 20,
            height: size.height - Settings.TOOLKIT_TAB_HEIGHT_PX - HINT_HEIGHT - 20
        };
        const areAllHidden = shownAnnotations.length > 0
            && shownAnnotations.every((annotation: ListedAnnotation) => annotation.isVisible === false);
        const hint = <div className='SpaceHint' style={{height: HINT_HEIGHT}}>
            <span>
                Press <span className='Key'>space</span> to {areAllHidden ? 'show' : 'hide'} the annotations,
                and click the <img className='EyeIcon' draggable={false} src={'ico/eye.png'} alt={'eye'}/> to
                show/hide just one criteria
            </span>
        </div>;

        if (annotations.length === 0) {
            return <div className='Content active' style={{height: listSize.height + HINT_HEIGHT + 20}}>
                <EmptyLabelList
                    labelBefore={'no annotation on this image'}
                    labelAfter={'no annotation on this image'}
                />
            </div>;
        }

        const contentHeight = shownAnnotations.length * LABEL_INPUT_FIELD_HEIGHT
            + (deletedAnnotations.length > 0
                ? DELETED_HEADER_HEIGHT + deletedAnnotations.length * LABEL_INPUT_FIELD_HEIGHT
                : 0);

        return <div
            className='Content active'
            style={{height: listSize.height + HINT_HEIGHT + 20}}
            onClickCapture={() => updateActiveLabelIdAction(null)}
        >
            {hint}
            <div style={{width: listSize.width, height: listSize.height}}>
                <Scrollbars>
                    <div style={{width: listSize.width, height: contentHeight}}>
                        {shownAnnotations.map((annotation: ListedAnnotation) => <LabelInputField
                            key={annotation.id}
                            id={annotation.id}
                            size={{width: listSize.width, height: LABEL_INPUT_FIELD_HEIGHT}}
                            isActive={annotation.id === activeLabelId}
                            isHighlighted={annotation.id === highlightedLabelId}
                            isVisible={annotation.isVisible}
                            value={getLabelName(annotation)}
                            options={labelNames}
                            readOnly={true}
                            onDelete={(id: string) => ReviewActions.setAnnotationDeleted(id, true)}
                            toggleLabelVisibility={(id: string) =>
                                LabelActions.toggleLabelVisibilityById(activeImageData.id, id)}
                        />)}
                        {deletedAnnotations.length > 0 && <>
                            <div className='DeletedHeader' style={{height: DELETED_HEADER_HEIGHT}}>
                                Deleted annotations - click to re-add
                            </div>
                            {deletedAnnotations.map((annotation: ListedAnnotation) =>
                                renderDeletedRow(annotation, listSize.width))}
                        </>}
                    </div>
                </Scrollbars>
            </div>
        </div>;
    };

    return (
        <div
            className="LabelsToolkit"
            ref={toolkitRef}
            onClick={() => ContextManager.switchCtx(ContextType.RIGHT_NAVBAR)}
        >
            {size && activeImageData && <>
                <div className="Header active" style={{height: Settings.TOOLKIT_TAB_HEIGHT_PX, cursor: 'default'}}>
                    <div className="Marker"/>
                    <div className="HeaderGroupWrapper">
                        <img draggable={false} className="Ico" src={'ico/polygon.png'} alt={'annotations'}/>
                        Annotations
                    </div>
                </div>
                {renderList()}
            </>}
        </div>
    );
};

const mapDispatchToProps = {
    updateActiveLabelIdAction: updateActiveLabelId
};

const mapStateToProps = (state: AppState) => ({
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    labelNames: state.labels.labels,
    activeLabelId: state.labels.activeLabelId,
    highlightedLabelId: state.labels.highlightedLabelId,
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LabelsToolkit);
