import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/manrope';
import { StudioAccess } from './components/StudioAccess';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <StudioAccess />
    </MotionConfig>
  </React.StrictMode>,
);
