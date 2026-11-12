import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material';
import api from '../../api/axios';
import { PageHeader, PatientPicker } from '../../components/ui';
import AuditEntryList from '../../components/audit/AuditEntryList';
import { AUDIT_AREAS } from '../../utils/audit';
import { toLocalDateString } from '../../utils/dates';
import { getFullName } from '../../utils/formatters';
import { staffRefId } from '../../utils/staff';

interface StaffOption {
    id: string;
    name: string;
}

/** Who changed what, clinic-wide (F7, admins). */
const AuditLogPage: React.FC = () => {
    const { t } = useTranslation();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [userId, setUserId] = useState('');
    const [area, setArea] = useState('');
    const [patientId, setPatientId] = useState<string | null>(null);
    const [staff, setStaff] = useState<StaffOption[]>([]);

    useEffect(() => {
        api.get('/users', { params: { status: 'all', limit: 100 } })
            .then((res) => {
                const payload = res.data?.data ?? res.data;
                const list: any[] = payload?.data ?? payload ?? [];
                setStaff(
                    list
                        .map((u) => ({ id: staffRefId(u), name: getFullName(u.firstName, u.lastName, u.patronymic) }))
                        .filter((u) => u.id)
                        .sort((a, b) => a.name.localeCompare(b.name)),
                );
            })
            .catch(() => setStaff([]));
    }, []);

    const filtered = !!(from || to || userId || area || patientId);
    const today = toLocalDateString();

    return (
        <Box>
            <PageHeader title={t('audit.title')} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: -1, mb: 2 }}>
                {t('audit.subtitle')}
            </Typography>

            <Paper sx={{ p: 2, mb: 2, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))', xl: '160px 160px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr) auto' }, alignItems: 'center' }}>
                <TextField size="small" type="date" label={t('audit.from')} value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: to || today }} />
                <TextField size="small" type="date" label={t('audit.to')} value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: from, max: today }} />
                <TextField select size="small" label={t('audit.who')} value={userId} onChange={(e) => setUserId(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                    <MenuItem value="">{t('audit.everyone')}</MenuItem>
                    {staff.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                </TextField>
                <TextField select size="small" label={t('audit.area')} value={area} onChange={(e) => setArea(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                    <MenuItem value="">{t('audit.allAreas')}</MenuItem>
                    {AUDIT_AREAS.map((a) => (
                        <MenuItem key={a} value={a}>{t(`audit.areas.${a}`)}</MenuItem>
                    ))}
                </TextField>
                <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 3', xl: 'auto' } }}>
                    <PatientPicker value={patientId} onChange={(id) => setPatientId(id)} label={t('audit.patient')} />
                </Box>
                <Button
                    color="inherit"
                    disabled={!filtered}
                    onClick={() => {
                        setFrom('');
                        setTo('');
                        setUserId('');
                        setArea('');
                        setPatientId(null);
                    }}
                    sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, justifySelf: { md: 'start' } }}
                >
                    {t('audit.clear')}
                </Button>
            </Paper>

            <AuditEntryList url="/audit" params={{ from, to, userId, area, patientId: patientId ?? undefined }} showPatient />
        </Box>
    );
};

export default AuditLogPage;
