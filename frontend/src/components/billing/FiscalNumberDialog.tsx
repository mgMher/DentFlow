import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import api from '../../api/axios';
import { apiErrorMessage } from '../../utils/apiError';
import { FISCAL_NUMBER, cleanFiscalNumber } from '../../utils/fiscal';

interface FiscalNumberDialogProps {
    /** Any payment of the receipt; the number covers all its parts. */
    paymentId: string | null;
    current?: string | null;
    /** What the receipt is for, e.g. "12 000 ֏ · cash · 15.11.2026". */
    summary?: string;
    onClose: () => void;
    onSaved: (fiscalNumber: string | null) => void;
}

/** F10: type the number printed on the cash register's fiscal receipt (or clear it). */
const FiscalNumberDialog: React.FC<FiscalNumberDialogProps> = ({ paymentId, current, summary, onClose, onSaved }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!paymentId) return;
        setValue(current ?? '');
        setError(null);
    }, [paymentId, current]);

    const clean = cleanFiscalNumber(value);
    const valid = !!clean && FISCAL_NUMBER.test(clean);

    const save = async (fiscalNumber: string | null) => {
        if (!paymentId) return;
        setBusy(true);
        setError(null);
        try {
            await api.patch(`/billing/payments/${paymentId}/fiscal`, { fiscalNumber });
            onSaved(fiscalNumber);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={!!paymentId} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t('fiscal.dialogTitle')}</DialogTitle>
            <DialogContent>
                {summary && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{summary}</Typography>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField
                    autoFocus
                    fullWidth
                    label={t('fiscal.number')}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && valid && save(clean)}
                    error={!!value.trim() && !valid}
                    helperText={value.trim() && !valid ? t('fiscal.invalid') : t('fiscal.hint')}
                    inputProps={{ maxLength: 40, 'data-testid': 'fiscal-number' }}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                {current && (
                    <Button color="error" onClick={() => save(null)} disabled={busy} sx={{ mr: 'auto' }}>{t('fiscal.clear')}</Button>
                )}
                <Button color="inherit" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={() => save(clean)} disabled={busy || !valid || clean === current}>{t('common.save')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default FiscalNumberDialog;
