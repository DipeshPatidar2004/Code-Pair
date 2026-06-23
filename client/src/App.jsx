import React from 'react';
import { Toaster } from 'react-hot-toast';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <>
      <div>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#252526',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          },
          success: {
            style: { borderLeft: '3px solid #6A9955' },
            theme: { primary: '#00C8FF' }
          },
          error: {
            style: { borderLeft: '3px solid #F87171' }
          }
        }} />
      </div>
      <AppRoutes />
    </>
  );
}

export default App;
