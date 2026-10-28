import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { hasPermission, Permission } from '../utils/permissions';

/** `const can = usePermission(); can('manageStaff')` */
export const usePermission = () => {
    const role = useSelector((state: RootState) => state.auth.user?.role);
    return useCallback((permission: Permission) => hasPermission(role, permission), [role]);
};
