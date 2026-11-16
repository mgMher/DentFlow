import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Box, Chip, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { PageHeader } from '../../components/ui';
import AuditEntryList from '../../components/audit/AuditEntryList';

type Kind = 'all' | 'platform' | 'signins';

/**
 * F13: what platform admins did (including what support looked at in
 * clinics), and sign-ins in every clinic. `?clinicId=` narrows it to one clinic.
 */
const PlatformAuditPage: React.FC = () => {
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const kind = (params.get('kind') as Kind) || 'all';
    const clinicId = params.get('clinicId') ?? undefined;

    const set = (key: string, value?: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    return (
        <Box>
            <PageHeader title={t('platform.log')} subtitle={t('platform.logSubtitle')} />
            <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <ToggleButtonGroup exclusive size="small" value={kind} onChange={(_, v) => v && set('kind', v === 'all' ? undefined : v)} sx={{ flexWrap: 'wrap' }}>
                    <ToggleButton value="all">{t('common.all')}</ToggleButton>
                    <ToggleButton value="platform">{t('platform.logPlatform')}</ToggleButton>
                    <ToggleButton value="signins">{t('platform.logSignIns')}</ToggleButton>
                </ToggleButtonGroup>
                {clinicId && <Chip label={t('platform.oneClinic')} onDelete={() => set('clinicId')} />}
            </Paper>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('platform.logHint')}</Typography>
            <AuditEntryList url="/platform/audit" params={{ kind, clinicId }} showClinic showPatient={false} />
        </Box>
    );
};

export default PlatformAuditPage;
