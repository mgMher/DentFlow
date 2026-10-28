import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePermission } from '../hooks';
import { Permission } from '../utils/permissions';

/** Route guard: a user without `permission` is sent to the dashboard instead of a page that only 403s. */
const RequirePermission: React.FC<{ permission: Permission }> = ({ permission }) => {
    const can = usePermission();
    return can(permission) ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default RequirePermission;
