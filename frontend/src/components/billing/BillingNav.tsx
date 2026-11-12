import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tab, Tabs } from '@mui/material';
import { usePermission } from '../../hooks';

const SECTIONS = [
    { path: '/billing', key: 'billing.sections.invoices' },
    { path: '/billing/cash', key: 'billing.sections.cash' },
    { path: '/billing/debtors', key: 'billing.sections.debtors' },
];

/** Invoices · Day report · Debtors, for the people who take payments (F5). */
const BillingNav: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const can = usePermission();
    if (!can('manageBilling')) return null;
    const current = SECTIONS.findIndex((s) => s.path === pathname);
    return (
        <Tabs
            value={current < 0 ? 0 : current}
            onChange={(_, index: number) => navigate(SECTIONS[index].path)}
            sx={{ mb: 2, displayPrint: 'none' }}
            variant="scrollable"
            allowScrollButtonsMobile
        >
            {SECTIONS.map((s) => (
                <Tab key={s.path} label={t(s.key)} />
            ))}
        </Tabs>
    );
};

export default BillingNav;
