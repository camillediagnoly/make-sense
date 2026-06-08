import React, {useState} from 'react'
import './GenericLabelTypePopup.scss'
import {LabelType} from '../../../data/enums/LabelType';
import {AppState} from '../../../store';
import {connect} from 'react-redux';
import {ImageButton} from '../../Common/ImageButton/ImageButton';
import {GenericYesNoPopup} from '../GenericYesNoPopup/GenericYesNoPopup';
import {ILabelToolkit, LabelToolkitData} from '../../../data/info/LabelToolkitData';
import {ProjectType} from '../../../data/enums/ProjectType';

interface IProps {
    title: string,
    activeLabelType: LabelType,
    projectType: ProjectType;
    onLabelTypeChange?: (labelType: LabelType) => any;
    acceptLabel: string;
    onAccept: (labelType: LabelType) => any;
    skipAcceptButton?: boolean;
    disableAcceptButton?: boolean;
    disabledTooltip?: string;
    rejectLabel: string;
    onReject: (labelType: LabelType) => any;
    renderInternalContent: (labelType: LabelType) => any;
    showSettingsIcon?: boolean;
    onSettingsIconClick?: () => void;
    settingsIconActive?: boolean;
    acceptButtonClassName?: string;
    popupClassName?: string;
    extraActionLabel?: string;
    onExtraAction?: (labelType: LabelType) => any;
    extraActionButtonClassName?: string;
}

const GenericLabelTypePopup: React.FC<IProps> = (
    {
        title,
        activeLabelType,
        projectType,
        onLabelTypeChange,
        acceptLabel,
        onAccept,
        skipAcceptButton,
        disableAcceptButton,
        disabledTooltip,
        rejectLabel,
        onReject,
        renderInternalContent,
        showSettingsIcon,
        onSettingsIconClick,
        settingsIconActive,
        acceptButtonClassName,
        popupClassName,
        extraActionLabel,
        onExtraAction,
        extraActionButtonClassName,
    }) => {

    const [labelType, setLabelType] = useState(activeLabelType);

    const getSidebarButtons = () => {
        const buttons = LabelToolkitData
            .filter((label: ILabelToolkit) => label.projectType === projectType)
            .map((label: ILabelToolkit) => {
                return <ImageButton
                    key={label.labelType}
                    image={label.imageSrc}
                    imageAlt={label.imageAlt}
                    buttonSize={{width: 40, height: 40}}
                    padding={20}
                    onClick={() => {
                        setLabelType(label.labelType);
                        onLabelTypeChange(label.labelType);
                    }}
                    isActive={labelType === label.labelType && !settingsIconActive}
                />
            });

        // Add settings icon after polygon (if showSettingsIcon is true)
        if (showSettingsIcon && onSettingsIconClick) {
            buttons.push(
                <ImageButton
                    key="settings"
                    image="ico/gears.png"
                    imageAlt="backup settings"
                    buttonSize={{width: 40, height: 40}}
                    padding={20}
                    onClick={onSettingsIconClick}
                    isActive={settingsIconActive}
                />
            );
        }

        return buttons;
    }

    const renderContent = () => {
        return (<div className='GenericLabelTypePopupContent'>
            <div className='LeftContainer'>
                {getSidebarButtons()}
            </div>
            <div className='RightContainer'>
                {renderInternalContent(labelType)}
            </div>
        </div>);
    }

    return(
        <GenericYesNoPopup
            title={title}
            renderContent={renderContent}
            acceptLabel={acceptLabel}
            onAccept={() => onAccept(labelType)}
            skipAcceptButton={skipAcceptButton}
            disableAcceptButton={disableAcceptButton}
            disabledTooltip={disabledTooltip}
            rejectLabel={rejectLabel}
            onReject={() => onReject(labelType)}
            acceptButtonClassName={acceptButtonClassName}
            popupClassName={popupClassName}
            extraActionLabel={extraActionLabel}
            onExtraAction={onExtraAction ? () => onExtraAction(labelType) : undefined}
            extraActionButtonClassName={extraActionButtonClassName}
        />
    );
};

const mapDispatchToProps = {};

const mapStateToProps = (state: AppState) => ({
    projectType: state.general.projectData.type
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(GenericLabelTypePopup);