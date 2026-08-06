import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import ProtectedRoute from './ProtectedRoute';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

// App pages
import DashboardPage from '../pages/dashboard/DashboardPage';
import PatientsListPage from '../pages/patients/PatientsListPage';
import PatientCreatePage from '../pages/patients/PatientCreatePage';
import PatientDetailPage from '../pages/patients/PatientDetailPage';
import PatientEditPage from '../pages/patients/PatientEditPage';
import AppointmentsPage from '../pages/appointments/AppointmentsPage';
import AppointmentDetailPage from '../pages/appointments/AppointmentDetailPage';
import DentalChartPage from '../pages/dental-records/DentalChartPage';
import TreatmentsPage from '../pages/treatments/TreatmentsPage';
import BillingListPage from '../pages/billing/BillingListPage';
import InvoiceDetailPage from '../pages/billing/InvoiceDetailPage';
import InvoiceCreatePage from '../pages/billing/InvoiceCreatePage';
import StaffListPage from '../pages/staff/StaffListPage';
import StaffDetailPage from '../pages/staff/StaffDetailPage';
import ReportsPage from '../pages/reports/ReportsPage';
import SettingsPage from '../pages/settings/SettingsPage';
import SchedulePage from '../pages/schedule/SchedulePage';
import NotificationsPage from '../pages/notifications/NotificationsPage';

interface AppRouterProps {
    themeMode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const AppRouter: React.FC<AppRouterProps> = ({ themeMode, onToggleTheme }) => {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout themeMode={themeMode} onToggleTheme={onToggleTheme} />}>
                    <Route path="/dashboard" element={<DashboardPage />} />

                    <Route path="/patients" element={<PatientsListPage />} />
                    <Route path="/patients/new" element={<PatientCreatePage />} />
                    <Route path="/patients/:id" element={<PatientDetailPage />} />
                    <Route path="/patients/:id/edit" element={<PatientEditPage />} />
                    <Route path="/patients/:id/chart" element={<DentalChartPage />} />

                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

                    <Route path="/treatments" element={<TreatmentsPage />} />

                    <Route path="/billing" element={<BillingListPage />} />
                    <Route path="/billing/new" element={<InvoiceCreatePage />} />
                    <Route path="/billing/:id" element={<InvoiceDetailPage />} />

                    <Route path="/staff" element={<StaffListPage />} />
                    <Route path="/staff/:id" element={<StaffDetailPage />} />

                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
            </Route>
        </Routes>
    );
};

export default AppRouter;
