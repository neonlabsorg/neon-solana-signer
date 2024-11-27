import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import SolanaNativeApp from './solana-native-app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<React.StrictMode><SolanaNativeApp /></React.StrictMode>);

reportWebVitals();
