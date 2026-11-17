import './harness';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MotionLab from './MotionLab';
import '../../styles/tokens.css';
import './lab.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <MotionLab />
  </StrictMode>,
);
