import React from 'react';
import { createRoot } from 'react-dom/client';
import LedgerApp from '../app/ledger-app';
import '../app/globals.css';
import '../app/green-theme.css';
import '../app/ledger-recording.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><LedgerApp localOnly /></React.StrictMode>);
