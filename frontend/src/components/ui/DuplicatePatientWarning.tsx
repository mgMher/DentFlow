import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { Patient } from '../../types';
import { formatDate, getFullName } from '../../utils/formatters';

interface DuplicatePatientWarningProps {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    /** Excluded from the results, so editing a patient never flags itself. */
    excludeId?: string;
    onOpen: (patientId: string) => void;
}

/**
 * Email is unique per clinic, but nothing stops a second record for the same
 * person under a different (or no) email. Warn — never block: real clinics do
 * have two patients sharing a name and birthday.
 */
const DuplicatePatientWarning: React.FC<DuplicatePatientWarningProps> = ({
    firstName,
    lastName,
    dateOfBirth,
    excludeId,
    onOpen,
}) => {
    const { t } = useTranslation();
    const [matches, setMatches] = useState<Patient[]>([]);

    const first = firstName.trim().toLowerCase();
    const last = lastName.trim().toLowerCase();

    useEffect(() => {
        if (!first || !last || !dateOfBirth) {
            setMatches([]);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const res: any = await api.get('/patients', {
                    params: { search: last, limit: 50 },
                });
                const payload = res.data?.data || res.data;
                const candidates: Patient[] = payload?.data || payload || [];

                const duplicates = candidates.filter(
                    (p) =>
                        p._id !== excludeId &&
                        p.firstName?.trim().toLowerCase() === first &&
                        p.lastName?.trim().toLowerCase() === last &&
                        (p.dateOfBirth || '').substring(0, 10) === dateOfBirth,
                );

                if (!cancelled) setMatches(duplicates);
            } catch {
                // A failed check must never block the form.
                if (!cancelled) setMatches([]);
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [first, last, dateOfBirth, excludeId]);

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
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => onOpen(match._id)}
                        sx={{ textAlign: 'left', width: 'fit-content' }}
                    >
                        {getFullName(match.firstName, match.lastName, match.patronymic)}
                        {match.dateOfBirth && ` · ${formatDate(match.dateOfBirth)}`}
                        {match.phone && ` · ${match.phone}`}
                    </Link>
                ))}
            </Box>
        </Alert>
    );
};

export default DuplicatePatientWarning;
