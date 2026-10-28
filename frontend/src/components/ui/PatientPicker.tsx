import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import api from '../../api/axios';
import { Patient } from '../../types';
import { patientName } from '../../utils/references';
import { formatArmenianPhone } from '../../utils/validators';

/** Booking and billing are refused by the API for these, so they are shown but not selectable. */
const CLOSED_STATUSES = new Set(['archived', 'deceased']);

const SEARCH_DELAY_MS = 300;
const PAGE_SIZE = 20;

interface PatientPickerProps {
    /** Selected patient id ('' or null for none). */
    value: string | null;
    onChange: (patientId: string | null, patient: Patient | null) => void;
    label?: string;
    required?: boolean;
    error?: boolean;
    helperText?: React.ReactNode;
    disabled?: boolean;
}

/**
 * Patient selector that searches on the server as you type.
 *
 * Pages used to load "all" patients into the shared list slice and filter in
 * the browser — which in practice meant the first 20 (the API caps a page at
 * 100 and rejected `limit=1000` outright), so patient #21 could not be booked
 * or billed, and the patients page list was overwritten as a side effect.
 * This keeps its own state and asks the API for matches.
 */
const PatientPicker: React.FC<PatientPickerProps> = ({
    value,
    onChange,
    label,
    required,
    error,
    helperText,
    disabled,
}) => {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const [options, setOptions] = useState<Patient[]>([]);
    const [selected, setSelected] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    // Keep the shown patient in step when the parent resets or preselects a value.
    useEffect(() => {
        if (!value) {
            setSelected(null);
            return;
        }
        if (selected?._id === value) return;

        let cancelled = false;
        api.get(`/patients/${value}`)
            .then((res) => {
                if (!cancelled) setSelected(res.data?.data ?? res.data);
            })
            .catch(() => {
                if (!cancelled) setSelected(null);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);
        const timer = setTimeout(() => {
            api.get('/patients', { params: { search: input.trim() || undefined, limit: PAGE_SIZE, sortBy: 'lastName' } })
                .then((res) => {
                    const payload = res.data?.data ?? res.data;
                    if (!cancelled) setOptions(payload?.data ?? []);
                })
                .catch(() => {
                    if (!cancelled) setOptions([]);
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, SEARCH_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [input, open]);

    return (
        <Autocomplete
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            value={selected}
            options={options}
            loading={loading}
            disabled={disabled}
            // The server already filtered by the search text.
            filterOptions={(x) => x}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            getOptionLabel={(p) => patientName(p)}
            getOptionDisabled={(p) => CLOSED_STATUSES.has(p.status as string)}
            onInputChange={(_, text, reason) => {
                if (reason === 'input') setInput(text);
                if (reason === 'clear') setInput('');
            }}
            onChange={(_, patient) => {
                setSelected(patient);
                onChange(patient?._id ?? null, patient);
            }}
            noOptionsText={input.trim() ? t('common.noResults') : t('common.typeToSearch')}
            loadingText={t('common.loading')}
            renderOption={(props, p) => (
                <li {...props} key={p._id}>
                    <Box>
                        <Typography variant="body2">{patientName(p)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {[p.phone && formatArmenianPhone(p.phone), CLOSED_STATUSES.has(p.status as string) && t(`patients.${p.status}`)]
                                .filter(Boolean)
                                .join(' · ')}
                        </Typography>
                    </Box>
                </li>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label ?? t('appointments.patient')}
                    required={required}
                    error={error}
                    helperText={helperText}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
        />
    );
};

export default PatientPicker;
