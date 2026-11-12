import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { Close as CloseIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { DocumentKind, PatientDocument } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { toLocalDateString } from '../../utils/dates';
import { ALL_TEETH } from '../../utils/dental';
import { ACCEPTED_FILES, DOCUMENT_KINDS, fileSize } from '../../utils/documents';

interface DocumentUploadDialogProps {
    open: boolean;
    patientId: string;
    /** E.g. the tooth whose drawer the upload started from. */
    presetTeeth?: number[];
    onClose: () => void;
    onUploaded: (docs: PatientDocument[]) => void;
}

/** A guess from the name only; the server decides the real type from the bytes. */
const kindFor = (file: File): DocumentKind => (file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'other' : 'xray');

/**
 * Upload one or more files with the same details (type, teeth, date, notes).
 * Several files are sent one after another so a failure names the file.
 */
const DocumentUploadDialog: React.FC<DocumentUploadDialogProps> = ({ open, patientId, presetTeeth, onClose, onUploaded }) => {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [kind, setKind] = useState<DocumentKind>('xray');
    const [kindTouched, setKindTouched] = useState(false);
    const [title, setTitle] = useState('');
    const [teeth, setTeeth] = useState<number[]>([]);
    const [takenAt, setTakenAt] = useState(toLocalDateString());
    const [notes, setNotes] = useState('');
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState<{ done: number; total: number; percent: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setFiles([]);
        setKind('xray');
        setKindTouched(false);
        setTitle('');
        setTeeth(presetTeeth ?? []);
        setTakenAt(toLocalDateString());
        setNotes('');
        setBusy(null);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const add = (list: FileList | null) => {
        if (!list?.length) return;
        const picked = Array.prototype.slice.call(list) as File[];
        setFiles((prev) => [...prev, ...picked.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
        if (!kindTouched) setKind(kindFor(picked[0]));
        setError(null);
    };

    const submit = async () => {
        setError(null);
        const done: PatientDocument[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setBusy({ done: i, total: files.length, percent: 0 });
            const form = new FormData();
            form.append('file', file, file.name);
            form.append('kind', kind);
            if (files.length === 1 && title.trim()) form.append('title', title.trim());
            if (teeth.length) form.append('teeth', teeth.join(','));
            if (takenAt) form.append('takenAt', takenAt);
            if (notes.trim()) form.append('notes', notes.trim());
            try {
                // The client defaults to JSON, which would turn the form into a JSON object;
                // multipart lets the browser send the file and set the boundary.
                const res = await api.post(`/patients/${patientId}/documents`, form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (e) => e.total && setBusy({ done: i, total: files.length, percent: Math.round((e.loaded / e.total) * 100) }),
                });
                done.push(res.data?.data ?? res.data);
            } catch (err) {
                // Keep what is left so the user can fix it and retry without re-sending the rest.
                setFiles(files.slice(i));
                setError(files.length > 1 ? `${file.name}: ${apiErrorMessage(err)}` : apiErrorMessage(err));
                setBusy(null);
                if (done.length) onUploaded(done);
                return;
            }
        }
        setBusy(null);
        toast.success(t('documents.uploaded', { count: done.length }));
        onUploaded(done);
        onClose();
    };

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('documents.uploadTitle')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => input.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        add(e.dataTransfer.files);
                    }}
                    sx={{
                        border: '2px dashed',
                        borderColor: dragging ? 'primary.main' : 'divider',
                        bgcolor: dragging ? 'action.hover' : 'transparent',
                        borderRadius: 2,
                        p: 3,
                        mt: 1,
                        textAlign: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <UploadIcon color="action" sx={{ fontSize: 40 }} />
                    <Typography>{t('documents.dropHere')}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('documents.fileTypes')}</Typography>
                    <input
                        ref={input}
                        type="file"
                        hidden
                        multiple
                        accept={ACCEPTED_FILES}
                        data-testid="document-file-input"
                        onChange={(e) => {
                            add(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </Box>

                {files.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                        {files.map((f) => (
                            <Chip
                                key={`${f.name}-${f.size}`}
                                label={`${f.name} · ${fileSize(f.size)}`}
                                onDelete={busy ? undefined : () => setFiles((prev) => prev.filter((p) => p !== f))}
                                deleteIcon={<CloseIcon />}
                                sx={{ maxWidth: '100%' }}
                            />
                        ))}
                    </Box>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                    <TextField
                        select
                        label={t('documents.kind')}
                        value={kind}
                        onChange={(e) => {
                            setKind(e.target.value as DocumentKind);
                            setKindTouched(true);
                        }}
                    >
                        {DOCUMENT_KINDS.map((k) => (
                            <MenuItem key={k} value={k}>{t(`documents.kinds.${k}`)}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        type="date"
                        label={t('documents.takenAt')}
                        value={takenAt}
                        onChange={(e) => setTakenAt(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ max: toLocalDateString() }}
                    />
                </Box>
                {files.length <= 1 && (
                    <TextField
                        fullWidth
                        label={t('documents.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={files[0]?.name}
                        helperText={t('documents.titleHint')}
                        inputProps={{ maxLength: 200 }}
                        sx={{ mt: 2 }}
                    />
                )}
                <Autocomplete
                    multiple
                    options={ALL_TEETH}
                    value={teeth}
                    onChange={(_, value) => setTeeth(value)}
                    getOptionLabel={(n) => String(n)}
                    filterSelectedOptions
                    renderInput={(params) => <TextField {...params} label={t('documents.teeth')} helperText={t('documents.teethHint')} />}
                    sx={{ mt: 2 }}
                />
                <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label={t('documents.notes')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    inputProps={{ maxLength: 2000 }}
                    sx={{ mt: 2 }}
                />
                {busy && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('documents.uploading', { done: busy.done + 1, total: busy.total })}
                        </Typography>
                        <LinearProgress variant="determinate" value={busy.percent} />
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit" disabled={!!busy}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={submit} disabled={!files.length || !!busy} startIcon={<UploadIcon />}>
                    {t('documents.upload')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DocumentUploadDialog;
