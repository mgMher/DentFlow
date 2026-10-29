import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusChip } from '../ui';
import { Invoice } from '../../types';

/** The stored status, or "Overdue" for an open invoice past its due date. */
const InvoiceStatusChip: React.FC<{ invoice: Pick<Invoice, 'status' | 'isOverdue'> }> = ({ invoice }) => {
    const { t } = useTranslation();
    const status = invoice.isOverdue ? 'overdue' : invoice.status;
    return <StatusChip status={status} label={t(`billing.${status}`)} />;
};

export default InvoiceStatusChip;
