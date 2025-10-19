import React, { useState, useRef, useEffect } from 'react';
import { connect } from 'react-redux';
import { AppState } from '../../../../store';
import { dismissBackupError } from '../../../../store/backup/actionCreators';
import './BackupStatusIndicator.scss';

interface IProps {
    isEnabled: boolean;
    status: 'idle' | 'saving' | 'success' | 'error';
    errorDismissed: boolean;
    dismissBackupError: () => void;
}

const BackupStatusIndicator: React.FC<IProps> = ({
    isEnabled,
    status,
    errorDismissed,
    dismissBackupError,
}) => {
    const [clickCount, setClickCount] = useState(0);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Determine which visual state to display
     */
    const getDisplayStatus = (): 'hidden' | 'idle' | 'success' | 'error' => {
        if (!isEnabled) return 'hidden';
        if (status === 'error' && !errorDismissed) return 'error';
        if (status === 'success') return 'success';
        if (status === 'saving') return 'success'; // Show as success during saving
        return 'idle';
    };

    const displayStatus = getDisplayStatus();

    /**
     * Handle click for error dismissal (requires double-click)
     */
    const handleClick = () => {
        // Only clickable when showing error
        if (displayStatus !== 'error') return;

        const newCount = clickCount + 1;
        setClickCount(newCount);

        // Clear existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        if (newCount === 2) {
            // Double-click detected - dismiss error
            dismissBackupError();
            setClickCount(0);
        } else {
            // First click - wait for second click within 500ms
            clickTimeoutRef.current = setTimeout(() => {
                setClickCount(0);
            }, 500);
        }
    };

    /**
     * Reset click count when status changes
     */
    useEffect(() => {
        setClickCount(0);
    }, [status]);

    /**
     * Cleanup timeout on unmount
     */
    useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
        };
    }, []);

    // Hide if disabled
    if (displayStatus === 'hidden') return null;

    return (
        <div
            className={`backup-status-circle ${displayStatus}`}
            onClick={handleClick}
            title={
                displayStatus === 'error'
                    ? 'Backup error - Double-click to dismiss'
                    : displayStatus === 'success'
                    ? 'Backup successful'
                    : 'Backup active'
            }
        />
    );
};

const mapStateToProps = (state: AppState) => ({
    isEnabled: state.backup.isEnabled,
    status: state.backup.status,
    errorDismissed: state.backup.errorDismissed,
});

const mapDispatchToProps = {
    dismissBackupError,
};

export default connect(mapStateToProps, mapDispatchToProps)(BackupStatusIndicator);
