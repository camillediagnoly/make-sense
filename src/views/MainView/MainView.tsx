import React from 'react';
import './MainView.scss';
import ImagesDropZone from './ImagesDropZone/ImagesDropZone';

const MainView: React.FC = () => {
    return (
        <div className='MainView'>
            <ImagesDropZone />
        </div>
    );
};

export default MainView;
