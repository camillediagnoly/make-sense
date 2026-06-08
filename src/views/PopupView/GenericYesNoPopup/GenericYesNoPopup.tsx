import React, {useEffect, useState} from 'react'
import './GenericYesNoPopup.scss'
import {TextButton} from '../../Common/TextButton/TextButton';
import {ContextManager} from '../../../logic/context/ContextManager';
import {ContextType} from '../../../data/enums/ContextType';
import classNames from 'classnames';

interface IProps {
    title: string;
    renderContent: () => any;
    acceptLabel?: string;
    onAccept?: () => any;
    skipAcceptButton?: boolean;
    disableAcceptButton?: boolean;
    disabledTooltip?: string;
    rejectLabel?: string;
    onReject?: () => any;
    skipRejectButton?: boolean;
    disableRejectButton?: boolean;
    popupClassName?: string;
    acceptButtonClassName?: string;
    extraActionLabel?: string;
    onExtraAction?: () => any;
    extraActionButtonClassName?: string;
}

export const GenericYesNoPopup: React.FC<IProps> = (
    {
        title,
        renderContent,
        acceptLabel,
        onAccept,
        skipAcceptButton,
        disableAcceptButton,
        disabledTooltip,
        rejectLabel,
        onReject,
        skipRejectButton,
        disableRejectButton,
        popupClassName,
        acceptButtonClassName,
        extraActionLabel,
        onExtraAction,
        extraActionButtonClassName
    }) => {

    const [status, setMountStatus] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        if (!status) {
            ContextManager.switchCtx(ContextType.POPUP);
            setMountStatus(true);
        }
    }, [status]);

    const handleDisabledAcceptClick = () => {
        if (disableAcceptButton && disabledTooltip) {
            setShowTooltip(true);
            setTimeout(() => setShowTooltip(false), 3000);
        }
    };

    return (
        <div className={classNames('GenericYesNoPopup', popupClassName)}>
            <div className='Header'>
                {title}
            </div>
            <div className='Content'>
                {renderContent()}
            </div>
            <div className='Footer'>
                {!skipRejectButton && <TextButton
                    label={rejectLabel ? rejectLabel : 'NO, THANKS'}
                    onClick={onReject}
                    externalClassName={'reject'}
                    isDisabled={disableRejectButton}
                />}
                {extraActionLabel && onExtraAction && <TextButton
                    label={extraActionLabel}
                    onClick={onExtraAction}
                    externalClassName={classNames('extra-action', extraActionButtonClassName)}
                />}
                {!skipAcceptButton && (
                    <div className='accept-button-wrapper'>
                        <TextButton
                            label={acceptLabel ? acceptLabel : 'YES'}
                            onClick={disableAcceptButton ? handleDisabledAcceptClick : onAccept}
                            externalClassName={classNames('accept', acceptButtonClassName)}
                            isDisabled={disableAcceptButton}
                        />
                        {showTooltip && disabledTooltip && (
                            <div className='disabled-button-tooltip'>
                                {disabledTooltip}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
};
