import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    ChevronLeft as PrevIcon,
    ChevronRight as NextIcon,
    Close as CloseIcon,
    DeleteOutline as DeleteIcon,
    Download as DownloadIcon,
    Edit as EditIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import api from '../../api/axios';
import { RootState } from '../../store';
import { usePermission } from '../../hooks';
import { DocumentKind, PatientDocument } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { ALL_TEETH } from '../../utils/dental';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { toLocalDateString } from '../../utils/dates';
import { DOCUMENT_KINDS, downloadDocument, fileSize, isImage, isPdf, useDocumentUrl } from '../../utils/documents';
import { ConfirmDialog } from '../ui';

interface DocumentViewerProps {
    /** The documents to page through; the viewer is open while `index` points at one. */
    docs: PatientDocument[];
    index: number | null;
    onIndex: (index: number | null) => void;
    /** After an edit or removal, so the list can reload. */
    onChanged: () => void;
}

const Body: React.FC<{ doc: PatientDocument }> = ({ doc }) => {
    const { t } = useTranslation();
    const viewable = doc.file.viewable;
    const url = useDocumentUrl(doc._id, viewable);
    const [zoom, setZoom] = useState(false);
    useEffect(() => setZoom(false), [doc._id]);

    if (!viewable) {
        return (
            <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => downloadDocument(doc)}>{t('documents.download')}</Button>}>
                {t('documents.notViewable')}
            </Alert>
        );
    }
    if (url === 'error') return <Alert severity="error">{t('documents.loadError')}</Alert>;
    if (!url) {
        return <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
    }
    if (isPdf(doc)) {
        return <Box component="iframe" src={`${url}#navpanes=0&view=FitH`} title={doc.title} sx={{ width: '100%', height: '70vh', border: 0, bgcolor: 'grey.100' }} />;
    }
    if (isImage(doc)) {
        return (
            <Box sx={{ position: 'relative', bgcolor: '#111', borderRadius: 1, overflow: 'auto', maxHeight: '70vh', textAlign: 'center' }}>
                <Box
                    component="img"
                    src={url}
                    alt={doc.title}
                    onClick={() => setZoom((z) => !z)}
                    sx={zoom ? { maxWidth: 'none', cursor: 'zoom-out', display: 'block' } : { maxWidth: '100%', maxHeight: '70vh', cursor: 'zoom-in', verticalAlign: 'middle' }}
                />
                <IconButton
                    size="small"
                    onClick={() => setZoom((z) => !z)}
                    sx={{ position: 'sticky', float: 'right', bottom: 8, right: 8, bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' } }}
                    aria-label={t(zoom ? 'documents.fit' : 'documents.actualSize')}
                >
                    {zoom ? <ZoomOutIcon fontSize="small" /> : <ZoomInIcon fontSize="small" />}
                </IconButton>
            </Box>
        );
    }
    return null;
};

/** Look at a document, page through the others, correct its details or remove it. */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ docs, index, onIndex, onChanged }) => {
    const { t, i18n } = useTranslation();
    const can = usePermission();
    const userId = useSelector((state: RootState) => state.auth.user?._id);
    const doc = index !== null ? docs[index] : undefined;
    const phone = useMediaQuery(useTheme().breakpoints.down('sm'));

    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ kind: 'xray' as DocumentKind, title: '', teeth: [] as number[], takenAt: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removing, setRemoving] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        setEditing(false);
        setError(null);
    }, [doc?._id]);

    // Left/right page through the documents while not typing.
    useEffect(() => {
        // Never while the remove reason is being typed: paging would swap the document being removed.
        if (index === null || editing || removing) return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
            if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
            if (e.key === 'ArrowRight' && index < docs.length - 1) onIndex(index + 1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [index, docs.length, editing, removing, onIndex]);

    if (!doc) return null;

    const uploaderId = typeof doc.uploadedBy === 'object' ? doc.uploadedBy?._id : doc.uploadedBy;
    const canEdit = can('manageDocuments') || (!!userId && uploaderId === userId);
    const canRemove = can('manageDocuments');

    const startEdit = () => {
        setForm({ kind: doc.kind, title: doc.title, teeth: doc.teeth, takenAt: doc.takenAt.slice(0, 10), notes: doc.notes ?? '' });
        setError(null);
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await api.patch(`/documents/${doc._id}`, { ...form, title: form.title.trim() || doc.title });
            toast.success(t('toast.saveSuccess'));
            setEditing(false);
            onChanged();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        try {
            await api.delete(`/documents/${doc._id}`, { data: { reason: reason.trim() } });
            toast.success(t('documents.removed'));
            setRemoving(false);
            setReason('');
            onIndex(null);
            onChanged();
        } catch (err) {
            toast.error(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Dialog open onClose={() => onIndex(null)} maxWidth="lg" fullWidth fullScreen={phone}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" noWrap title={doc.title}>{doc.title}</Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                            {t(`documents.kinds.${doc.kind}`)} · {formatDate(doc.takenAt, 'dd.MM.yyyy', i18n.language)}
                            {doc.teeth.length > 0 && ` · ${t('dental.teeth')} ${doc.teeth.join(', ')}`}
                        </Typography>
                    </Box>
                    {docs.length > 1 && !phone && (
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {index! + 1} / {docs.length}
                        </Typography>
                    )}
                    <IconButton onClick={() => onIndex(index! - 1)} disabled={index === 0} aria-label={t('documents.previous')}>
                        <PrevIcon />
                    </IconButton>
                    <IconButton onClick={() => onIndex(index! + 1)} disabled={index === docs.length - 1} aria-label={t('documents.next')}>
                        <NextIcon />
                    </IconButton>
                    <IconButton onClick={() => onIndex(null)} aria-label={t('common.close')}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, gap: 2 }}>
                        <Body doc={doc} />
                        <Box>
                            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                            {editing ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <TextField size="small" label={t('documents.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} inputProps={{ maxLength: 200 }} />
                                    <TextField select size="small" label={t('documents.kind')} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DocumentKind })}>
                                        {DOCUMENT_KINDS.map((k) => (
                                            <MenuItem key={k} value={k}>{t(`documents.kinds.${k}`)}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        size="small"
                                        type="date"
                                        label={t('documents.takenAt')}
                                        value={form.takenAt}
                                        onChange={(e) => setForm({ ...form, takenAt: e.target.value })}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ max: toLocalDateString() }}
                                    />
                                    <Autocomplete
                                        multiple
                                        size="small"
                                        options={ALL_TEETH}
                                        value={form.teeth}
                                        onChange={(_, value) => setForm({ ...form, teeth: value })}
                                        getOptionLabel={(n) => String(n)}
                                        filterSelectedOptions
                                        renderInput={(params) => <TextField {...params} label={t('documents.teeth')} />}
                                    />
                                    <TextField size="small" multiline minRows={3} label={t('documents.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} inputProps={{ maxLength: 2000 }} />
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                        <Button color="inherit" onClick={() => setEditing(false)} disabled={saving}>{t('common.cancel')}</Button>
                                        <Button variant="contained" onClick={save} disabled={saving}>{t('common.save')}</Button>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    {doc.notes && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{doc.notes}</Typography>}
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{t('documents.file')}</Typography>
                                        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                            {doc.file.originalName} · {fileSize(doc.file.size)}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">{t('documents.uploadedByLabel')}</Typography>
                                        <Typography variant="body2">
                                            {staffName(doc.uploadedBy)} · {formatDateTime(doc.createdAt, i18n.language)}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 1.5 }}>
                    {canRemove && !editing && (
                        <Button color="error" startIcon={<DeleteIcon />} onClick={() => setRemoving(true)} sx={{ mr: 'auto' }}>
                            {t('documents.remove')}
                        </Button>
                    )}
                    {canEdit && !editing && (
                        <Button startIcon={<EditIcon />} onClick={startEdit}>{t('common.edit')}</Button>
                    )}
                    <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadDocument(doc)}>
                        {t('documents.download')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={removing}
                title={t('documents.removeTitle')}
                message={t('documents.removeMessage')}
                confirmLabel={t('documents.remove')}
                variant="danger"
                confirmDisabled={reason.trim().length < 3 || saving}
                onCancel={() => setRemoving(false)}
                onConfirm={remove}
            >
                <TextField
                    autoFocus
                    fullWidth
                    required
                    label={t('documents.removeReason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 2 }}
                />
            </ConfirmDialog>
        </>
    );
};

export default DocumentViewer;
