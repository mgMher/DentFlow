import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, IconButton, Link, Tooltip, Typography } from '@mui/material';
import {
    Add as AddIcon,
    DeleteOutline as DeleteIcon,
    Edit as EditIcon,
    Groups as FamilyIcon,
    Star as MainIcon,
    Telegram as TelegramIcon,
} from '@mui/icons-material';
import api from '../../api/axios';
import { ConfirmDialog } from '../ui';
import { usePermission } from '../../hooks';
import { FamilyPerson, PatientFamily } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { formatArmenianPhone } from '../../utils/validators';
import { getFullName } from '../../utils/formatters';
import GuardianDialog, { GuardianInput } from './GuardianDialog';

type FamilyGuardian = PatientFamily['guardians'][number];

const personName = (p: Pick<FamilyPerson, 'firstName' | 'lastName' | 'patronymic'>) => getFullName(p.firstName, p.lastName, p.patronymic);

/** On the patient profile (F8): parents / guardians, children and siblings, with who is the main contact. */
const FamilyCard: React.FC<{ patientId: string }> = ({ patientId }) => {
    const { t } = useTranslation();
    const can = usePermission();
    const editor = can('editPatients');
    const [family, setFamily] = useState<PatientFamily | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dialog, setDialog] = useState<{ guardian?: FamilyGuardian } | null>(null);
    const [removing, setRemoving] = useState<FamilyGuardian | null>(null);

    const load = useCallback(() => {
        api.get(`/patients/${patientId}/family`)
            .then((res) => setFamily(res.data?.data ?? res.data))
            .catch((err) => setError(apiErrorMessage(err)));
    }, [patientId]);

    useEffect(load, [load]);

    if (!family) return error ? <Alert severity="error">{error}</Alert> : null;

    const save = async (input: GuardianInput) => {
        const editing = dialog?.guardian;
        const body = editing
            ? { relationship: input.relationship, ...(input.isPrimary ? { isPrimary: true } : {}), ...(editing.patient ? {} : { name: input.name, phone: input.phone }) }
            : input.patientId
              ? { patientId: input.patientId, relationship: input.relationship, isPrimary: input.isPrimary }
              : { name: input.name, phone: input.phone, relationship: input.relationship, isPrimary: input.isPrimary };
        const res = editing ? await api.patch(`/patients/${patientId}/guardians/${editing._id}`, body) : await api.post(`/patients/${patientId}/guardians`, body);
        setFamily(res.data?.data ?? res.data);
        setDialog(null);
        toast.success(t('toast.saveSuccess'));
    };

    const remove = async () => {
        if (!removing) return;
        try {
            const res = await api.delete(`/patients/${patientId}/guardians/${removing._id}`);
            setFamily(res.data?.data ?? res.data);
            toast.success(t('family.removed'));
        } catch (err) {
            toast.error(apiErrorMessage(err));
        } finally {
            setRemoving(null);
        }
    };

    const ageText = (age: number | null) => (age === null ? '' : t('family.age', { count: age }));
    const guardianName = (g: FamilyGuardian) => (g.patient ? personName(g.patient) : g.name ?? '—');
    const guardianPhone = (g: FamilyGuardian) => (g.patient ? g.patient.phone : g.phone);
    const people = (title: string, list: (FamilyPerson & { relationship?: string })[], extra?: (p: FamilyPerson & { relationship?: string }) => string) =>
        list.length > 0 && (
            <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">{title}</Typography>
                {list.map((p) => (
                    <Box key={p._id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', py: 0.25 }}>
                        <Link component={RouterLink} to={`/patients/${p._id}`} variant="body2">{personName(p)}</Link>
                        <Typography variant="caption" color="text.secondary">
                            {[ageText(p.age), extra?.(p)].filter(Boolean).join(' · ')}
                        </Typography>
                    </Box>
                ))}
            </>
        );

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <FamilyIcon color="action" />
                    <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>{t('family.title')}</Typography>
                    {family.minor && <Chip size="small" color="info" label={t('family.minor', { age: family.age })} />}
                </Box>
                <Divider sx={{ mb: 1.5 }} />

                {family.minor && !family.guardians.length && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>{t('family.noGuardianWarning')}</Alert>
                )}

                <Typography variant="caption" color="text.secondary">{t('family.guardians')}</Typography>
                {!family.guardians.length && (
                    <Typography variant="body2" color="text.secondary">{t('family.noGuardians')}</Typography>
                )}
                {family.guardians.map((g) => (
                    <Box key={g._id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                {g.patient ? (
                                    <Link component={RouterLink} to={`/patients/${g.patient._id}`} variant="body2" fontWeight={600}>{guardianName(g)}</Link>
                                ) : (
                                    <Typography variant="body2" fontWeight={600}>{guardianName(g)}</Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">· {t(`family.relationships.${g.relationship}`)}</Typography>
                                {g.isPrimary && <Chip size="small" icon={<MainIcon />} label={t('family.main')} color="primary" variant="outlined" />}
                                {g.patient?.telegram && (
                                    <Tooltip title={t('family.hasTelegram')}><TelegramIcon fontSize="small" color="primary" /></Tooltip>
                                )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                {guardianPhone(g) ? formatArmenianPhone(guardianPhone(g)!) : ''}
                                {!g.patient && ` · ${t('family.contactOnly')}`}
                            </Typography>
                        </Box>
                        {editor && (
                            <Box sx={{ flexShrink: 0 }}>
                                <IconButton size="small" aria-label={t('common.edit')} onClick={() => setDialog({ guardian: g })}><EditIcon fontSize="small" /></IconButton>
                                <IconButton size="small" aria-label={t('family.remove')} onClick={() => setRemoving(g)}><DeleteIcon fontSize="small" /></IconButton>
                            </Box>
                        )}
                    </Box>
                ))}
                {editor && family.guardians.length < 4 && (
                    <Button size="small" startIcon={<AddIcon />} onClick={() => setDialog({})} sx={{ mt: 0.5 }}>
                        {t('family.addGuardian')}
                    </Button>
                )}

                {people(t('family.children'), family.children, (c) => t(`family.relationships.${c.relationship}`))}
                {people(t('family.siblings'), family.siblings)}
            </CardContent>

            <GuardianDialog
                open={!!dialog}
                first={!dialog?.guardian && !family.guardians.length}
                initial={
                    dialog?.guardian
                        ? {
                              isPatient: !!dialog.guardian.patient,
                              label: guardianName(dialog.guardian),
                              name: dialog.guardian.name,
                              phone: dialog.guardian.phone,
                              relationship: dialog.guardian.relationship,
                              isPrimary: dialog.guardian.isPrimary,
                          }
                        : undefined
                }
                onClose={() => setDialog(null)}
                onSubmit={save}
            />
            <ConfirmDialog
                open={!!removing}
                title={t('family.removeTitle')}
                message={t('family.removeMessage', { name: removing ? guardianName(removing) : '' })}
                confirmLabel={t('family.remove')}
                variant="danger"
                onCancel={() => setRemoving(null)}
                onConfirm={remove}
            />
        </Card>
    );
};

export default FamilyCard;
