import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Card, CardContent, CardHeader, Chip, IconButton, Typography } from '@mui/material';
import { Add as AddIcon, Close as RemoveIcon, Phone as PhoneIcon } from '@mui/icons-material';
import { formatArmenianPhone } from '../../utils/validators';
import GuardianDialog, { GuardianInput } from './GuardianDialog';

interface GuardiansDraftProps {
    guardians: GuardianInput[];
    onChange: (guardians: GuardianInput[]) => void;
    /** Under 18 by the date of birth typed so far: the section asks for a guardian. */
    minor: boolean;
    phoneEmpty: boolean;
    onUsePhone: (phone: string) => void;
}

/** "Parents and guardians" on the new-patient form (F8); they are added once the patient is saved. */
const GuardiansDraft: React.FC<GuardiansDraftProps> = ({ guardians, onChange, minor, phoneEmpty, onUsePhone }) => {
    const { t } = useTranslation();
    const [adding, setAdding] = useState(false);
    const withPhone = guardians.find((g) => g.isPrimary && g.phone) ?? guardians.find((g) => g.phone);

    const add = (g: GuardianInput) => {
        const primary = g.isPrimary || !guardians.length;
        onChange([...guardians.map((x) => (primary ? { ...x, isPrimary: false } : x)), { ...g, isPrimary: primary }]);
        setAdding(false);
    };

    return (
        <Card sx={{ mb: 3, ...(minor ? { borderLeft: 4, borderColor: 'info.main' } : {}) }}>
            <CardHeader
                title={<Typography variant="h6" fontWeight={600}>{t('family.guardiansTitle')}</Typography>}
                subheader={minor ? t('family.minorHint') : t('family.optionalHint')}
            />
            <CardContent sx={{ pt: 0 }}>
                {minor && !guardians.length && <Alert severity="warning" sx={{ mb: 2 }}>{t('family.noGuardianWarning')}</Alert>}
                {guardians.map((g, i) => (
                    <Box key={`${g.patientId ?? g.name}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>{g.label ?? g.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            · {t(`family.relationships.${g.relationship}`)}
                            {g.phone && ` · ${formatArmenianPhone(g.phone)}`}
                        </Typography>
                        {g.isPrimary && <Chip size="small" label={t('family.main')} color="primary" variant="outlined" />}
                        <Box sx={{ flexGrow: 1 }} />
                        <IconButton size="small" aria-label={t('family.remove')} onClick={() => {
                            const rest = guardians.filter((_, j) => j !== i);
                            if (g.isPrimary && rest.length) rest[0] = { ...rest[0], isPrimary: true };
                            onChange(rest);
                        }}>
                            <RemoveIcon fontSize="small" />
                        </IconButton>
                    </Box>
                ))}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {guardians.length < 4 && (
                        <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)}>{t('family.addGuardian')}</Button>
                    )}
                    {phoneEmpty && withPhone?.phone && (
                        <Button size="small" startIcon={<PhoneIcon />} onClick={() => onUsePhone(withPhone.phone!)}>
                            {t('family.useGuardianPhone')}
                        </Button>
                    )}
                </Box>
            </CardContent>
            <GuardianDialog open={adding} first={!guardians.length} onClose={() => setAdding(false)} onSubmit={add} />
        </Card>
    );
};

export default GuardiansDraft;
