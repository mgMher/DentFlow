import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { accountKind, homeOf } from '../utils/account';

/**
 * F13: the platform console is for platform admins; clinic pages are for a
 * clinic's staff and for support views. Anyone else goes to their own home.
 */
const RequireAccount: React.FC<{ platform?: boolean }> = ({ platform = false }) => {
    const user = useSelector((state: RootState) => state.auth.user);
    const kind = accountKind(user);
    if ((kind === 'platform') !== platform) return <Navigate to={homeOf(kind)} replace />;
    return <Outlet />;
};

export default RequireAccount;
