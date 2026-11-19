import React, { useState } from 'react';
import classNames from 'classnames';
import { ClipLoader } from 'react-spinners';
import './FolderDropView.scss';
import {
    DroppedItem,
    DropResult,
    IMAGES_FOLDER_NAME,
    PartialDrop,
    ReviewFolderError,
    ReviewFolderReader,
} from '../../logic/review/ReviewFolderReader';
import { ReviewActions } from '../../logic/review/ReviewActions';

const FolderIcon: React.FC = () => (
    <svg viewBox='0 0 64 52' className='StructureIcon' aria-hidden='true'>
        <path d='M4 6a4 4 0 0 1 4-4h16l6 6h26a4 4 0 0 1 4 4v4H4z' fill='#e95420'/>
        <rect x='2' y='14' width='60' height='36' rx='4' fill='#8a8a8a'/>
    </svg>
);

const FileIcon: React.FC = () => (
    <svg viewBox='0 0 44 52' className='StructureIcon' aria-hidden='true'>
        <path d='M4 2h26l12 12v34a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z' fill='#f2f2f2'/>
        <path d='M30 2v12h12' fill='#cfcfcf'/>
        <text x='22' y='38' textAnchor='middle' fontSize='11' fontWeight='700' fill='#555'>JSON</text>
    </svg>
);

// What the folder to drop must hold: an "images" folder and a .json file, side by side
const FolderStructure: React.FC = () => (
    <div className='FolderStructure'>
        <div className='StructureItem'>
            <FolderIcon/>
            <span>{IMAGES_FOLDER_NAME}</span>
            <small>a folder with the pictures</small>
        </div>
        <div className='StructureItem'>
            <FileIcon/>
            <span>labels.json</span>
            <small>a file with the annotations<br/>(its name can be different)</small>
        </div>
    </div>
);

const FolderDropView: React.FC = () => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    // The "images" folder or the .json file, dropped on its own, waiting for the other one
    const [partialDrop, setPartialDrop] = useState<PartialDrop | null>(null);
    const canPickFolder = ReviewFolderReader.supportsDirectoryPicker();

    const loadFolder = async (read: () => Promise<DropResult>) => {
        setIsLoading(true);
        setProblems([]);
        try {
            const result: DropResult = await read();
            if (result.kind === 'partial') {
                setPartialDrop(result.partialDrop);
                setIsLoading(false);
                return;
            }
            setPartialDrop(null);
            await ReviewActions.startProject(result.folder);
        } catch (error) {
            setPartialDrop(null);
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
        loadFolder(() => ReviewFolderReader.readDrop(items, partialDrop));
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
            loadFolder(async () => ({kind: 'folder', folder: await ReviewFolderReader.readFromDirectoryPicker()}));
        }
    };

    const renderDropZoneContent = () => {
        if (isLoading) {
            return <>
                <ClipLoader color={'white'} size={50} loading={true}/>
                <p className='extraBold'>Opening the folder, please wait…</p>
            </>;
        }
        if (partialDrop) {
            return <>
                <img draggable={false} alt={''} src={'ico/box-opened.png'}/>
                <p className='extraBold'>
                    {partialDrop.imagesFolder
                        ? 'Now drop the .json file here'
                        : `Now drop the "${IMAGES_FOLDER_NAME}" folder here`}
                </p>
            </>;
        }
        return <>
            <img draggable={false} alt={''} src={'ico/box-opened.png'}/>
            <p className='extraBold'>Drop them here</p>
            {canPickFolder && <p className='Secondary'>or click here to choose the folder that contains them</p>}
        </>;
    };

    const renderPartialDrop = () => {
        const pictures = (count: number) => count === 1 ? '1 picture' : `${count} pictures`;
        return <div className='PartialDrop' role='status'>
            <p>
                {partialDrop.imagesFolder
                    ? <>✓ The &quot;{partialDrop.imagesFolder.name}&quot; folder is here
                        ({pictures(partialDrop.imageCount)}).</>
                    : <>✓ &quot;{partialDrop.annotationsFile.name}&quot; is here.</>}
            </p>
            <p className='extraBold'>
                {partialDrop.imagesFolder
                    ? 'Now drag and drop the .json file.'
                    : `Now drag and drop the "${IMAGES_FOLDER_NAME}" folder.`}
            </p>
            <button type='button' className='StartOver' onClick={() => setPartialDrop(null)}>Start over</button>
        </div>;
    };

    return (
        <div className='FolderDropView'>
            <div className='FolderDropViewContent'>
                <img className='Logo' draggable={false} alt={'Diagnoly'} src={'diagnoly-logo-blue.png'}/>
                <div className='Explanation'>
                    <p className='extraBold'>
                        Drag and drop the &quot;{IMAGES_FOLDER_NAME}&quot; folder and the .json file
                    </p>
                    <p className='Secondary'>Together, or one after the other</p>
                    <FolderStructure/>
                    <p className='Secondary'>You can also drag and drop the folder that contains them.</p>
                </div>
                <div
                    className={classNames('FolderDropZone', {
                        'dragOver': isDragOver,
                        'withError': problems.length > 0,
                        'clickable': canPickFolder && !isLoading && !partialDrop,
                        'waiting': !!partialDrop,
                    })}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={() => setIsDragOver(false)}
                    onClick={partialDrop ? undefined : onClick}
                >
                    {renderDropZoneContent()}
                </div>
                {partialDrop && !isLoading && renderPartialDrop()}
                {!canPickFolder && <p className='BrowserTip'>
                    Tip: for the best experience, please use Google Chrome or Microsoft Edge. Your review can then
                    be saved directly into the folder, instead of being downloaded.
                </p>}
                {problems.length > 0 && <div className='FolderErrors' role='alert'>
                    {problems.map((problem: string) => <p key={problem}>{problem}</p>)}
                </div>}
            </div>
        </div>
    );
};

export default FolderDropView;
