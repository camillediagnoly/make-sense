import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.scss';
import App from './App';
import configureStore from './configureStore';
import { Provider } from 'react-redux';
import { AppInitializer } from './logic/initializer/AppInitializer';
import { EditorContext } from './logic/context/EditorContext'; // Add this import

export const store = configureStore();

// Initialize the application
AppInitializer.inti(); // Note: there appears to be a typo here - should be 'init'

// Initialize keyboard shortcuts after the store is set up
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure store is fully initialized
  setTimeout(() => {
    try {
      EditorContext.initializeActions();
      console.log('Keyboard shortcuts initialized');
    } catch (error) {
      console.error('Error initializing keyboard shortcuts:', error);
    }
  }, 100);
});

// Subscribe to Redux store changes to update shortcuts when they change
store.subscribe(() => {
  const state = store.getState();
  
  // Check if we have the keyboard shortcuts state (prevents errors)
  if (state && state.general && state.general.keyboardShortcuts) {
    try {
      EditorContext.initializeActions();
    } catch (error) {
    }
  }
});

const root = ReactDOM.createRoot(document.getElementById('root') || document.createElement('div'));
root.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>
);

