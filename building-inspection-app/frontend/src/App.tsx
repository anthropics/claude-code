import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ReportPage } from './pages/ReportPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes within the app layout */}
        <Route
          path="/"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />
        <Route
          path="/reports"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />

        {/* Full-page report editor (no sidebar) */}
        <Route path="/report/:id" element={<ReportPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
