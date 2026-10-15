import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import CertificatePage from './certificate/CertificatePage.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import Login from './admin/Login.jsx';
import Events from './admin/Events.jsx';
import EventEditor from './admin/EventEditor.jsx';
import Issue from './admin/Issue.jsx';
import Certificates from './admin/Certificates.jsx';
import CertificateDetail from './admin/CertificateDetail.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/c/:id" element={<CertificatePage />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Events />} />
          <Route path="events/new" element={<EventEditor />} />
          <Route path="events/:id" element={<EventEditor />} />
          <Route path="issue" element={<Issue />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="certificates/:id" element={<CertificateDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
