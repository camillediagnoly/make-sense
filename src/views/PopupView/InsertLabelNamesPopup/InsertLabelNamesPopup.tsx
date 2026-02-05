import React, { useEffect, useState } from 'react';
import './InsertLabelNamesPopup.scss';
import { GenericYesNoPopup } from '../GenericYesNoPopup/GenericYesNoPopup';
import { PopupWindowType } from '../../../data/enums/PopupWindowType';
import { updateLabelNames } from '../../../store/labels/actionCreators';
import { updateActivePopupType, updatePerClassColorationStatus } from '../../../store/general/actionCreators';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import Scrollbars from 'react-custom-scrollbars-2';
import { ImageButton } from '../../Common/ImageButton/ImageButton';
import { LabelName } from '../../../store/labels/types';
import { LabelUtil } from '../../../utils/LabelUtil';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { LabelActions } from '../../../logic/actions/LabelActions';
import { ColorSelectorView } from './ColorSelectorView/ColorSelectorView';
import { Settings } from '../../../settings/Settings';
import { reject, sample, filter, uniq } from 'lodash';
import { ProjectType } from '../../../data/enums/ProjectType';
import { submitNewNotification } from '../../../store/notifications/actionCreators';
import { INotification } from '../../../store/notifications/types';
import { NotificationUtil } from '../../../utils/NotificationUtil';
import { NotificationsDataMap } from '../../../data/info/NotificationsData';
import { Notification } from '../../../data/enums/Notification';
import { StyledTextField } from '../../Common/StyledTextField/StyledTextField';

interface IProps {
    updateActivePopupTypeAction: (activePopupType: PopupWindowType) => any;
    updateLabelNamesAction: (labels: LabelName[]) => any;
    updatePerClassColorationStatusAction: (updatePerClassColoration: boolean) => any;
    submitNewNotificationAction: (notification: INotification) => any;
    isUpdate: boolean;
    projectType: ProjectType;
    enablePerClassColoration: boolean;
}

const InsertLabelNamesPopup: React.FC<IProps> = (
    {
        updateActivePopupTypeAction,
        updateLabelNamesAction,
        updatePerClassColorationStatusAction,
        submitNewNotificationAction,
        isUpdate,
        projectType,
        enablePerClassColoration
    }) => {
    const normalizeLabelName = (labelName: LabelName): LabelName => ({
        ...labelName,
        isVisible: labelName.isVisible !== false,
    });

    const [labelNames, setLabelNames] = useState(
        LabelsSelector.getLabelNames().map(normalizeLabelName)
    );

    const validateEmptyLabelNames = (): boolean => {
        const emptyLabelNames = filter(labelNames, (labelName: LabelName) => labelName.name === '');
        return emptyLabelNames.length === 0;
    };

    const validateNonUniqueLabelNames = (): boolean => {
        const uniqueLabelNames = uniq(labelNames.map((labelName: LabelName) => labelName.name));
        return uniqueLabelNames.length === labelNames.length;
    };

    const callbackWithLabelNamesValidation = (callback: () => any): () => any => {
        return () => {
            if (!validateEmptyLabelNames()) {
                submitNewNotificationAction(NotificationUtil
                    .createErrorNotification(NotificationsDataMap[Notification.EMPTY_LABEL_NAME_ERROR]));
                return;
            }
            if (validateNonUniqueLabelNames()) {
                callback();
            } else {
                submitNewNotificationAction(NotificationUtil
                    .createErrorNotification(NotificationsDataMap[Notification.NON_UNIQUE_LABEL_NAMES_ERROR]));
            }
        };
    };

    const addLabelNameCallback = () => {
        const newLabelNames = [
            ...labelNames,
            LabelUtil.createLabelName('')
        ];
        setLabelNames(newLabelNames);
    };

    const safeAddLabelNameCallback = () => callbackWithLabelNamesValidation(addLabelNameCallback)();

    const deleteLabelNameCallback = (id: string) => {
        const newLabelNames = reject(labelNames, { id });
        setLabelNames(newLabelNames);
    };

    useEffect(() => {
        if (projectType === ProjectType.OBJECT_DETECTION && !enablePerClassColoration) {
            updatePerClassColorationStatusAction(true);
        }
    }, [projectType, enablePerClassColoration, updatePerClassColorationStatusAction]);

    const changeLabelNameColorCallback = (id: string) => {
        const newLabelNames = labelNames.map((labelName: LabelName) => {
            return labelName.id === id ? { ...labelName, color: sample(Settings.LABEL_COLORS_PALETTE) } : labelName;
        });
        setLabelNames(newLabelNames);
    };

    const hasLabels = labelNames.length > 0;
    const areAllLabelsVisible = hasLabels && labelNames.every((labelName: LabelName) => labelName.isVisible !== false);

    const toggleLabelVisibilityAcrossImages = (id: string) => {
        setLabelNames((prev) =>
            prev.map((labelName: LabelName) => {
                if (labelName.id === id) {
                    const nextVisibility = !(labelName.isVisible !== false);
                    LabelActions.setLabelVisibilityForLabelName(
                        id,
                        nextVisibility
                    );
                    return { ...labelName, isVisible: nextVisibility };
                }
                return labelName;
            })
        );
    };

    const toggleAllLabelVisibilityAcrossImages = () => {
        if (!hasLabels) {
            return;
        }

        const nextVisibility = !areAllLabelsVisible;
        const labelIds = labelNames.map((labelName: LabelName) => labelName.id);

        LabelActions.setLabelVisibilityForLabelNames(labelIds, nextVisibility);
        setLabelNames(labelNames.map((labelName: LabelName) => ({ ...labelName, isVisible: nextVisibility })));
    };

    const onKeyUpCallback = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            safeAddLabelNameCallback();
        }
    };

    const onChange = (id: string, value: string) => {
        const newLabelNames = labelNames.map((labelName: LabelName) => {
            return labelName.id === id ? {
                ...labelName, name: value
            } : labelName;
        });
        setLabelNames(newLabelNames);
    };

    const labelInputs = labelNames.map((labelName: LabelName) => {
        const onChangeCallback = (event: React.ChangeEvent<HTMLInputElement>) =>
            onChange(labelName.id, event.target.value);
        const onDeleteCallback = () => deleteLabelNameCallback(labelName.id);
        const onChangeColorCallback = () => changeLabelNameColorCallback(labelName.id);
        return <div className='LabelEntry' key={labelName.id}>
            <StyledTextField variant='standard'
                id={'key'}
                autoComplete={'off'}
                autoFocus={true}
                type={'text'}
                margin={'dense'}
                label={'Insert label'}
                onKeyUp={onKeyUpCallback}
                value={labelName.name}
                onChange={onChangeCallback}
                style={{ width: 280 }}
                InputLabelProps={{
                    shrink: true,
                }}
            />
            {projectType === ProjectType.OBJECT_DETECTION && <ColorSelectorView
                color={labelName.color}
                onClick={onChangeColorCallback}
            />}
            <ImageButton
                image={(labelName.isVisible !== false) ? 'ico/eye.png' : 'ico/hide.png'}
                imageAlt={'label_visibility'}
                buttonSize={{ width: 30, height: 30 }}
                onClick={() => toggleLabelVisibilityAcrossImages(labelName.id)}
            />
            <ImageButton
                image={'ico/trash.png'}
                imageAlt={'remove_label'}
                buttonSize={{ width: 30, height: 30 }}
                onClick={onDeleteCallback}
            />
        </div>;
    });


    const onCreateAcceptCallback = () => {
        const nonEmptyLabelNames: LabelName[] = reject(labelNames,
            (labelName: LabelName) => labelName.name.length === 0)
            .map(normalizeLabelName);
        if (labelNames.length > 0) {
            updateLabelNamesAction(nonEmptyLabelNames);
        }
        updateActivePopupTypeAction(null);
    };

    const safeOnCreateAcceptCallback = () => callbackWithLabelNamesValidation(onCreateAcceptCallback)();

    const onUpdateAcceptCallback = () => {
        const nonEmptyLabelNames: LabelName[] = reject(labelNames,
            (labelName: LabelName) => labelName.name.length === 0)
            .map(normalizeLabelName);
        const missingIds: string[] = LabelUtil.labelNamesIdsDiff(LabelsSelector.getLabelNames(), nonEmptyLabelNames);
        LabelActions.removeLabelNames(missingIds);
        updateLabelNamesAction(nonEmptyLabelNames);
        updateActivePopupTypeAction(null);
    };

    const safeOnUpdateAcceptCallback = () => callbackWithLabelNamesValidation(onUpdateAcceptCallback)();

    const onCreateRejectCallback = () => {
        updateActivePopupTypeAction(PopupWindowType.LOAD_LABEL_NAMES);
    };

    const onUpdateRejectCallback = () => {
        updateActivePopupTypeAction(null);
    };

    const renderContent = () => {
        return (<div className='InsertLabelNamesPopup'>
            <div className='LeftContainer'>
                <ImageButton
                    image={'ico/plus.png'}
                    imageAlt={'plus'}
                    buttonSize={{ width: 40, height: 40 }}
                    padding={25}
                    onClick={safeAddLabelNameCallback}
                    externalClassName={'monochrome'}
                />
                <ImageButton
                    image={areAllLabelsVisible ? 'ico/eye.png' : 'ico/hide.png'}
                    imageAlt={'toggle_visibility_all'}
                    buttonSize={{ width: 40, height: 40 }}
                    padding={18}
                    onClick={toggleAllLabelVisibilityAcrossImages}
                    isActive={hasLabels && !areAllLabelsVisible}
                    isDisabled={!hasLabels}
                    externalClassName={'monochrome'}
                    title={areAllLabelsVisible ? 'Hide all labels' : 'Show all labels'}
                />
            </div>
            <div className='RightContainer'>
                <div className='Message'>
                    {
                        isUpdate ?
                            'You can now edit the label names you use to describe the objects in the photos. Use the ' +
                            '+ button to add a new empty text field.' :
                            'Before you start, you can create a list of labels you plan to assign to objects in your ' +
                            'project. You can also choose to skip that part for now and define label names as you go.'
                    }
                </div>
                <div className='LabelsContainer'>
                    {Object.keys(labelNames).length !== 0 ? <Scrollbars>
                        <div
                            className='InsertLabelNamesPopupContent'
                        >
                            {labelInputs}
                        </div>
                    </Scrollbars> :
                        <div
                            className='EmptyList'
                            onClick={addLabelNameCallback}
                        >
                            <img
                                draggable={false}
                                alt={'upload'}
                                src={'ico/type-writer.png'}
                            />
                            <p className='extraBold'>Your label list is empty</p>
                        </div>}
                </div>
            </div>
        </div>);
    };

    return (
        <GenericYesNoPopup
            title={isUpdate ? 'Edit labels' : 'Create labels'}
            renderContent={renderContent}
            acceptLabel={isUpdate ? 'Accept' : 'Start project'}
            onAccept={isUpdate ? safeOnUpdateAcceptCallback : safeOnCreateAcceptCallback}
            rejectLabel={isUpdate ? 'Cancel' : 'Load labels from file'}
            onReject={isUpdate ? onUpdateRejectCallback : onCreateRejectCallback}
        />);
};

const mapDispatchToProps = {
    updateActivePopupTypeAction: updateActivePopupType,
    updateLabelNamesAction: updateLabelNames,
    updatePerClassColorationStatusAction: updatePerClassColorationStatus,
    submitNewNotificationAction: submitNewNotification
};

const mapStateToProps = (state: AppState) => ({
    projectType: state.general.projectData.type,
    enablePerClassColoration: state.general.enablePerClassColoration
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(InsertLabelNamesPopup);
