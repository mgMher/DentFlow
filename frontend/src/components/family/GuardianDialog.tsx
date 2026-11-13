import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import { PatientPicker } from '../ui';
import { GuardianRelationship, Patient } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { RELATIONSHIPS } from '../../utils/family';
import { getFullName } from '../../utils/formatters';
import { isArmenianPhone } from '../../utils/validators';

/** What the dialog produces; `label` / `phone` of a linked patient are for display only. */
export interface GuardianInput {
    patientId?: string;
    label?: string;
    name?: string;
    phone?: string;
    relationship: GuardianRelationship;
    isPrimary: boolean;
}

interface GuardianDialogProps {
    open: boolean;
    /** Editing an existing guardian: only relationship, main, and a contact's name / phone. */
    initial?: GuardianInput & { isPatient: boolean };
    /** The first guardian is the main one whatever is ticked. */
    first?: boolean;
    onClose: () => void;
    /** Saves (profile) or keeps it for later (new patient); a thrown error is shown in the dialog. */
    onSubmit: (input: GuardianInput) => Promise<void> | void;
}

/** Add or change a parent / guardian (F8): a patient of the clinic, or a contact who isn't one. */
const GuardianDialog: React.FC<GuardianDialogProps> = ({ open, initial, first, onClose, onSubmit }) => {
    const { t } = useTranslation();
    const editing = !!initial;
    const [kind, setKind] = useState<'patient' | 'contact'>('patient');
    const [patient, setPatient] = useState<Patient | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [relationship, setRelationship] = useState<GuardianRelationship>('mother');
    const [isPrimary, setIsPrimary] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setKind(initial && !initial.isPatient ? 'contact' : 'patient');
        setPatient(null);
        setName(initial?.name ?? '');
        setPhone(initial?.phone ?? '');
        setRelationship(initial?.relationship ?? 'mother');
        setIsPrimary(initial?.isPrimary ?? !!first);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const contact = kind === 'contact';
    const phoneOk = !contact || isArmenianPhone(phone);
    const valid = editing ? (!contact || (name.trim() && phoneOk)) : contact ? name.trim() && phoneOk : !!patient;

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            await onSubmit(
                contact
                    ? { name: name.trim(), phone: phone.trim(), relationship, isPrimary }
                    : editing
                      ? { relationship, isPrimary }
                      : {
                            patientId: patient!._id,
                            label: getFullName(patient!.firstName, patient!.lastName, patient!.patronymic),
                            phone: patient!.phone,
                            relationship,
                            isPrimary,
                        },
            );
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{t(editing ? 'family.editGuardian' : 'family.addGuardian')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {!editing && (
                        <ToggleButtonGroup exclusive fullWidth size="small" value={kind} onChange={(_, v) => v && setKind(v)}>
                            <ToggleButton value="patient">{t('family.isPatient')}</ToggleButton>
                            <ToggleButton value="contact">{t('family.isContact')}</ToggleButton>
                        </ToggleButtonGroup>
                    )}
                    {editing && !contact && initial?.label && <TextField label={t('family.guardian')} value={initial.label} disabled />}
                    {!editing && !contact && (
                        <PatientPicker value={patient?._id ?? null} onChange={(_, p) => setPatient(p)} label={t('family.findPatient')} required />
                    )}
                    {contact && (
                        <>
                            <TextField required label={t('family.name')} value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 150 }} />
                            <TextField
                                required
                                label={t('patients.phone')}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                error={!!phone && !phoneOk}
                                helperText={phone && !phoneOk ? t('validation.invalidArmenianPhone') : t('family.contactPhoneHint')}
                                placeholder="+374 XX XXX XXX"
                            />
                        </>
                    )}
                    <TextField select label={t('family.relationship')} value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship)}>
                        {RELATIONSHIPS.map((r) => (
                            <MenuItem key={r} value={r}>{t(`family.relationships.${r}`)}</MenuItem>
                        ))}
                    </TextField>
                    <FormControlLabel
                        control={<Checkbox checked={isPrimary || !!first} disabled={!!first || initial?.isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />}
                        label={t('family.makeMain')}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button color="inherit" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={submit} disabled={!valid || saving}>{t('common.save')}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default GuardianDialog;
