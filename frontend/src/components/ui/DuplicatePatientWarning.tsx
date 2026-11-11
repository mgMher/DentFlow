import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { Patient } from '../../types';
import { formatDate, getFullName } from '../../utils/formatters';
import { formatArmenianPhone, isArmenianPhone, normalizeArmenianPhone } from '../../utils/validators';

interface DuplicatePatientWarningProps {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone?: string;
    email?: string;
    /** Excluded from the results, so editing a patient never flags itself. */
    excludeId?: string;
}

const CHECK_DELAY_MS = 500;

/**
 * "Is this person already registered?" — same name and date of birth, same
 * phone, or same email, matched exactly on the server.
 *
 * Warns, never blocks: twins, namesakes and a family sharing one email are
 * all legitimate. Matches open in a new tab so the half-filled form survives.
 */
const DuplicatePatientWarning: React.FC<DuplicatePatientWarningProps> = ({
    firstName,
    lastName,
    dateOfBirth,
    phone = '',
    email = '',
    excludeId,
}) => {
    const { t } = useTranslation();
    const [matches, setMatches] = useState<Patient[]>([]);

    const first = firstName.trim();
    const last = lastName.trim();
    const normalizedPhone = isArmenianPhone(phone) ? normalizeArmenianPhone(phone) : '';
    const trimmedEmail = email.trim().toLowerCase();
    const hasNameKey = !!(first && last && dateOfBirth);

    useEffect(() => {
        if (!hasNameKey && !normalizedPhone && !trimmedEmail) {
            setMatches([]);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const res: any = await api.get('/patients/duplicates', {
                    params: {
                        ...(hasNameKey ? { firstName: first, lastName: last, dateOfBirth } : {}),
                        phone: normalizedPhone || undefined,
                        email: trimmedEmail || undefined,
                        excludeId,
                    },
                });
                if (!cancelled) setMatches(res.data?.data ?? []);
            } catch {
                // A failed check must never block the form.
                if (!cancelled) setMatches([]);
            }
        }, CHECK_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [first, last, dateOfBirth, hasNameKey, normalizedPhone, trimmedEmail, excludeId]);

    if (matches.length === 0) {
        return null;
    }

    return (
        <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>{t('patients.possibleDuplicate')}</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
                {t('patients.possibleDuplicateHint')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {matches.map((match) => (
                    <Link
                        key={match._id}
                        href={`/patients/${match._id}`}
                        target="_blank"
                        rel="noopener"
                        underline="hover"
                        sx={{ width: 'fit-content' }}
                    >
                        {getFullName(match.firstName, match.lastName, match.patronymic)}
                        {match.dateOfBirth && ` · ${formatDate(match.dateOfBirth)}`}
                        {match.phone && ` · ${formatArmenianPhone(match.phone)}`}
                        {match.email && ` · ${match.email}`}
                    </Link>
                ))}
            </Box>
        </Alert>
    );
};

export default DuplicatePatientWarning;
