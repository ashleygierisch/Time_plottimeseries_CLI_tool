import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { FRAMED_MESSAGE, isFramed } from './frameGuard.ts';
import './style.css';

const root = document.getElementById('root') as HTMLElement;

if (isFramed(window)) {
  root.textContent = FRAMED_MESSAGE;
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
