import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Box, Button, Card, CardContent, Divider, Link, Typography } from '@mui/material';
import { Groups as FamilyIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { usePermission } from '../../hooks';
import { FamilyAccount } from '../../types';
import { formatCurrency, getFullName } from '../../utils/formatters';
import TakePaymentDialog from './TakePaymentDialog';

interface FamilyAccountCardProps {
    patientId: string;
    /** Changes when the patient's own account changed, so the family figures follow. */
    version: number;
    onChange: () => void;
}

/**
 * On a guardian's billing (F8): what each child owes, the family total, and
 * one payment for all of it. Hidden for patients who are nobody's guardian.
 */
const FamilyAccountCard: React.FC<FamilyAccountCardProps> = ({ patientId, version, onChange }) => {
    const { t } = useTranslation();
    const can = usePermission();
    const [family, setFamily] = useState<FamilyAccount | null>(null);
    const [paying, setPaying] = useState(false);

    const load = useCallback(() => {
        api.get(`/billing/patients/${patientId}/family-account`)
            .then((res) => setFamily(res.data?.data ?? res.data))
            .catch(() => setFamily(null));
    }, [patientId]);

    useEffect(load, [load, version]);

    if (!family || family.members.length < 2) return null;

    const money = (n: number) => formatCurrency(n, family.currency);
    const names = Object.fromEntries(
        family.members.map((m) => [m.patient._id, getFullName(m.patient.firstName, m.patient.lastName, m.patient.patronymic)]),
    );

    return (
        <Card sx={{ mb: 2 }} variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <FamilyIcon color="action" />
                    <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
                        {t('family.billingTitle')}
                    </Typography>
                    {can('manageBilling') && family.outstanding > 0 && (
                        <Button variant="outlined" onClick={() => setPaying(true)}>
                            {t('family.takePayment')}
                        </Button>
                    )}
                </Box>
                <Divider sx={{ my: 1.5 }} />
                {family.members.map((m) => (
                    <Box key={m.patient._id} sx={{ display: 'flex', gap: 2, py: 0.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            {m.self ? (
                                <Typography variant="body2" fontWeight={600}>{names[m.patient._id]}</Typography>
                            ) : (
                                <Link component={RouterLink} to={`/patients/${m.patient._id}?tab=billing`} variant="body2">
                                    {names[m.patient._id]}
                                </Link>
                            )}
                        </Box>
                        {m.credit > 0 && (
                            <Typography variant="caption" color="success.main">
                                {t('account.credit')}: {money(m.credit)}
                            </Typography>
                        )}
                        <Typography variant="body2" fontWeight={600} color={m.outstanding > 0 ? 'error.main' : 'text.secondary'} sx={{ minWidth: 90, textAlign: 'right' }}>
                            {money(m.outstanding)}
                        </Typography>
                    </Box>
                ))}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={700}>{t('family.owesTotal')}</Typography>
                    <Typography variant="body2" fontWeight={700} color={family.outstanding > 0 ? 'error.main' : 'text.primary'}>
                        {money(family.outstanding)}
                    </Typography>
                </Box>
            </CardContent>
            <TakePaymentDialog
                open={paying}
                patientId={patientId}
                account={family}
                familyNames={names}
                onClose={() => setPaying(false)}
                onDone={() => {
                    setPaying(false);
                    toast.success(t('toast.saveSuccess'));
                    load();
                    onChange();
                }}
            />
        </Card>
    );
};

export default FamilyAccountCard;
