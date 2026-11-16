import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import ProtectedRoute from './ProtectedRoute';
import RequirePermission from './RequirePermission';
import RequireAccount from './RequireAccount';

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
import TreatmentsPage from '../pages/treatments/TreatmentsPage';
import BillingListPage from '../pages/billing/BillingListPage';
import InvoiceDetailPage from '../pages/billing/InvoiceDetailPage';
import InvoiceEditorPage from '../pages/billing/InvoiceEditorPage';
import CashReportPage from '../pages/billing/CashReportPage';
import DebtorsPage from '../pages/billing/DebtorsPage';
import FiscalReceiptsPage from '../pages/billing/FiscalReceiptsPage';
import TreatmentPlanPage from '../pages/plans/TreatmentPlanPage';
import StaffListPage from '../pages/staff/StaffListPage';
import StaffDetailPage from '../pages/staff/StaffDetailPage';
import ReportsPage from '../pages/reports/ReportsPage';
import SettingsPage from '../pages/settings/SettingsPage';
import SchedulePage from '../pages/schedule/SchedulePage';
import NotificationsPage from '../pages/notifications/NotificationsPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import AccountSecurityPage from '../pages/account/AccountSecurityPage';
import AuditLogPage from '../pages/audit/AuditLogPage';
import PlatformClinicsPage from '../pages/platform/PlatformClinicsPage';
import PlatformClinicPage from '../pages/platform/PlatformClinicPage';
import PlatformAuditPage from '../pages/platform/PlatformAuditPage';
import PlatformAdminsPage from '../pages/platform/PlatformAdminsPage';

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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout themeMode={themeMode} onToggleTheme={onToggleTheme} />}>
                    {/* F13: the platform console, for platform admins only. */}
                    <Route element={<RequireAccount platform />}>
                        <Route path="/platform" element={<PlatformClinicsPage />} />
                        <Route path="/platform/clinics/:id" element={<PlatformClinicPage />} />
                        <Route path="/platform/audit" element={<PlatformAuditPage />} />
                        <Route path="/platform/admins" element={<PlatformAdminsPage />} />
                    </Route>

                    {/* Your own account: everyone. */}
                    <Route path="/account" element={<AccountSecurityPage />} />

                    {/* A clinic's pages: its staff, and support views. */}
                    <Route element={<RequireAccount />}>
                    <Route path="/dashboard" element={<DashboardPage />} />

                    <Route path="/patients" element={<PatientsListPage />} />
                    <Route path="/patients/new" element={<PatientCreatePage />} />
                    <Route path="/patients/:id" element={<PatientDetailPage />} />
                    <Route path="/patients/:id/edit" element={<PatientEditPage />} />
                    <Route path="/patients/:id/plans/:planId" element={<TreatmentPlanPage />} />

                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/appointments/:id" element={<AppointmentDetailPage />} />

                    <Route path="/treatments" element={<TreatmentsPage />} />

                    <Route element={<RequirePermission permission="viewBilling" />}>
                        <Route path="/billing" element={<BillingListPage />} />
                        <Route path="/billing/:id" element={<InvoiceDetailPage />} />
                    </Route>
                    <Route element={<RequirePermission permission="manageBilling" />}>
                        <Route path="/billing/new" element={<InvoiceEditorPage />} />
                        <Route path="/billing/:id/edit" element={<InvoiceEditorPage />} />
                        <Route path="/billing/cash" element={<CashReportPage />} />
                        <Route path="/billing/debtors" element={<DebtorsPage />} />
                        <Route path="/billing/fiscal" element={<FiscalReceiptsPage />} />
                    </Route>

                    <Route path="/staff" element={<StaffListPage />} />
                    <Route path="/staff/:id" element={<StaffDetailPage />} />

                    <Route element={<RequirePermission permission="viewReports" />}>
                        <Route path="/reports" element={<ReportsPage />} />
                    </Route>
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route element={<RequirePermission permission="manageClinic" />}>
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                    <Route element={<RequirePermission permission="viewAuditLog" />}>
                        <Route path="/audit" element={<AuditLogPage />} />
                    </Route>

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                </Route>
            </Route>
        </Routes>
    );
};

export default AppRouter;
