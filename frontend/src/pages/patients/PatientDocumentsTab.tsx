import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Chip, Grid, MenuItem, TextField } from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { EmptyState, LoadingSpinner } from '../../components/ui';
import DocumentThumb from '../../components/documents/DocumentThumb';
import DocumentUploadDialog from '../../components/documents/DocumentUploadDialog';
import DocumentViewer from '../../components/documents/DocumentViewer';
import { DocumentKind, PatientDocument } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { ALL_TEETH } from '../../utils/dental';
import { DOCUMENT_KINDS } from '../../utils/documents';

/** X-rays, photos and signed papers of one patient (F6). */
const PatientDocumentsTab: React.FC<{ patientId: string }> = ({ patientId }) => {
    const { t } = useTranslation();
    const [docs, setDocs] = useState<PatientDocument[] | null>(null);
    const [kind, setKind] = useState<DocumentKind | ''>('');
    const [tooth, setTooth] = useState<number | ''>('');
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const load = useCallback(() => {
        api.get(`/patients/${patientId}/documents`, { params: { ...(kind ? { kind } : {}), ...(tooth !== '' ? { tooth } : {}) } })
            .then((res) => {
                setDocs(res.data?.data ?? res.data);
                setError(null);
            })
            .catch((err) => setError(apiErrorMessage(err, 'documents.loadListError')));
    }, [patientId, kind, tooth]);

    useEffect(load, [load]);

    const filtered = !!kind || tooth !== '';

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
                <Chip label={t('common.all')} color={!kind ? 'primary' : 'default'} onClick={() => setKind('')} />
                {DOCUMENT_KINDS.map((k) => (
                    <Chip key={k} label={t(`documents.kinds.${k}`)} color={kind === k ? 'primary' : 'default'} onClick={() => setKind(kind === k ? '' : k)} />
                ))}
                <TextField
                    select
                    size="small"
                    label={t('documents.tooth')}
                    value={tooth}
                    onChange={(e) => setTooth(e.target.value === '' ? '' : Number(e.target.value))}
                    SelectProps={{ displayEmpty: true }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 130 }}
                >
                    <MenuItem value="">{t('documents.anyTooth')}</MenuItem>
                    {ALL_TEETH.map((n) => (
                        <MenuItem key={n} value={n}>{n}</MenuItem>
                    ))}
                </TextField>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploading(true)}>
                    {t('documents.upload')}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!docs ? (
                !error && <LoadingSpinner />
            ) : !docs.length ? (
                filtered ? <EmptyState title={t('documents.noneFiltered')} /> : <EmptyState title={t('documents.none')} description={t('documents.noneHint')} />
            ) : (
                <Grid container spacing={2}>
                    {docs.map((doc, i) => (
                        <Grid item xs={6} sm={4} md={3} lg={2} key={doc._id}>
                            <DocumentThumb doc={doc} onOpen={() => setOpen(i)} />
                        </Grid>
                    ))}
                </Grid>
            )}

            <DocumentUploadDialog
                open={uploading}
                patientId={patientId}
                presetTeeth={tooth !== '' ? [tooth] : undefined}
                onClose={() => setUploading(false)}
                onUploaded={load}
            />
            <DocumentViewer docs={docs ?? []} index={open} onIndex={setOpen} onChanged={load} />
        </Box>
    );
};

export default PatientDocumentsTab;
