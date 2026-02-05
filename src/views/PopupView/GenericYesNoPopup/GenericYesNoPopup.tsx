import React, {useEffect, useState} from 'react'
import './GenericYesNoPopup.scss'
import {TextButton} from '../../Common/TextButton/TextButton';
import {ContextManager} from '../../../logic/context/ContextManager';
import {ContextType} from '../../../data/enums/ContextType';

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
        disableRejectButton
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
        <div className='GenericYesNoPopup'>
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
                {!skipAcceptButton && (
                    <div className='accept-button-wrapper'>
                        <TextButton
                            label={acceptLabel ? acceptLabel : 'YES'}
                            onClick={disableAcceptButton ? handleDisabledAcceptClick : onAccept}
                            externalClassName={'accept'}
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
