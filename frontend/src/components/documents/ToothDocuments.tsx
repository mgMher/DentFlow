import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Typography } from '@mui/material';
import { AddCircleOutline as AddIcon, PermMedia as MediaIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { PatientDocument } from '../../types';
import DocumentThumb from './DocumentThumb';
import DocumentUploadDialog from './DocumentUploadDialog';
import DocumentViewer from './DocumentViewer';

/** X-rays and photos linked to one tooth, inside the tooth drawer. */
const ToothDocuments: React.FC<{ patientId: string; toothNumber: number }> = ({ patientId, toothNumber }) => {
    const { t } = useTranslation();
    const [docs, setDocs] = useState<PatientDocument[] | null>(null);
    const [uploading, setUploading] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const load = useCallback(() => {
        let live = true;
        api.get(`/patients/${patientId}/documents`, { params: { tooth: toothNumber } })
            .then((res) => live && setDocs(res.data?.data ?? res.data))
            .catch(() => live && setDocs([]));
        return () => {
            live = false;
        };
    }, [patientId, toothNumber]);

    useEffect(() => {
        setDocs(null);
        setOpen(null);
        return load();
    }, [load]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MediaIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
                    {t('documents.forTooth')}
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setUploading(true)}>
                    {t('documents.add')}
                </Button>
            </Box>
            {docs && !docs.length && (
                <Typography variant="body2" color="text.secondary">{t('documents.noneForTooth')}</Typography>
            )}
            {!!docs?.length && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                    {docs.map((doc, i) => (
                        <DocumentThumb key={doc._id} doc={doc} height={80} compact onOpen={() => setOpen(i)} />
                    ))}
                </Box>
            )}
            <DocumentUploadDialog
                open={uploading}
                patientId={patientId}
                presetTeeth={[toothNumber]}
                onClose={() => setUploading(false)}
                onUploaded={() => load()}
            />
            <DocumentViewer docs={docs ?? []} index={open} onIndex={setOpen} onChanged={() => load()} />
        </Box>
    );
};

export default ToothDocuments;
