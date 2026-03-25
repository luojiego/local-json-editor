import React from 'react';
import ReactDOM from 'react-dom/client';
import { loader } from '@monaco-editor/react';

import App from './App';
import './styles.css';

configureMonacoLoader();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function configureMonacoLoader(): void {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  loader.config({
    paths: {
      vs: `${normalizedBaseUrl}monaco-editor/vs`,
    },
  });
}
