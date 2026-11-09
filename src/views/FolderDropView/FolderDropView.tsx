import React, { useState } from 'react';
import classNames from 'classnames';
import { ClipLoader } from 'react-spinners';
import './FolderDropView.scss';
import {
    DroppedItem,
    EXPECTED_FOLDER_STRUCTURE,
    ReviewFolder,
    ReviewFolderError,
    ReviewFolderReader,
} from '../../logic/review/ReviewFolderReader';
import { ReviewActions } from '../../logic/review/ReviewActions';

const FolderDropView: React.FC = () => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const canPickFolder = ReviewFolderReader.supportsDirectoryPicker();

    const loadFolder = async (readFolder: () => Promise<ReviewFolder>) => {
        setIsLoading(true);
        setProblems([]);
        try {
            await ReviewActions.startProject(await readFolder());
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                setIsLoading(false);
                return;
            }
            setProblems(error instanceof ReviewFolderError
                ? error.problems
                : [`The folder could not be read: ${error instanceof Error ? error.message : String(error)}`]);
            setIsLoading(false);
        }
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        if (isLoading) {
            return;
        }
        // The dropped items have to be read before this handler returns
        const items: DroppedItem[] = ReviewFolderReader.captureDroppedItems(event.dataTransfer);
        loadFolder(() => ReviewFolderReader.readFromDroppedItems(items));
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const onClick = () => {
        if (canPickFolder && !isLoading) {
            loadFolder(() => ReviewFolderReader.readFromDirectoryPicker());
        }
    };

    const renderDropZoneContent = () => {
        if (isLoading) {
            return <>
                <ClipLoader color={'white'} size={50} loading={true}/>
                <p className='extraBold'>Loading the folder</p>
            </>;
        }
        return <>
            <img draggable={false} alt={'upload'} src={'ico/box-opened.png'}/>
            <p className='extraBold'>Drop your folder here</p>
            {canPickFolder && <p>or click to select it</p>}
        </>;
    };

    return (
        <div className='FolderDropView'>
            <div className='FolderDropViewContent'>
                <div
                    className={classNames('FolderDropZone', {
                        'dragOver': isDragOver,
                        'withError': problems.length > 0,
                        'clickable': canPickFolder && !isLoading,
                    })}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={() => setIsDragOver(false)}
                    onClick={onClick}
                >
                    {renderDropZoneContent()}
                </div>
                {problems.length > 0 && <div className='FolderErrors'>
                    <p className='extraBold'>This folder cannot be reviewed</p>
                    <ul>
                        {problems.map((problem: string) => <li key={problem}>{problem}</li>)}
                    </ul>
                    <p>The folder must hold exactly:</p>
                    <pre>{EXPECTED_FOLDER_STRUCTURE.join('\n')}</pre>
                </div>}
            </div>
        </div>
    );
};

export default FolderDropView;
