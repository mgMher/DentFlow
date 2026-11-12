import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import AuditEntryList from '../../components/audit/AuditEntryList';

/** Everything recorded about this patient: who changed what and when (F7). */
const PatientHistoryTab: React.FC<{ patientId: string }> = ({ patientId }) => {
    const { t } = useTranslation();
    return (
        <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('audit.patientSubtitle')}
            </Typography>
            <AuditEntryList url={`/patients/${patientId}/history`} />
        </>
    );
};

export default PatientHistoryTab;
