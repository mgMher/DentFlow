import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardActionArea, CircularProgress, Typography } from '@mui/material';
import { BrokenImage as BrokenIcon, Description as FileIcon, PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { PatientDocument } from '../../types';
import { formatDate } from '../../utils/formatters';
import { isImage, isPdf, useDocumentUrl } from '../../utils/documents';

/** The picture itself for images, an icon for PDFs and DICOM. */
export const DocumentPreview: React.FC<{ doc: PatientDocument; height: number }> = ({ doc, height }) => {
    const image = isImage(doc);
    const url = useDocumentUrl(doc._id, image);
    const box = { height, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: image ? '#111' : 'action.hover' };
    if (!image) {
        return <Box sx={box}>{isPdf(doc) ? <PdfIcon sx={{ fontSize: height / 2.5 }} color="error" /> : <FileIcon sx={{ fontSize: height / 2.5 }} color="action" />}</Box>;
    }
    if (url === 'error') return <Box sx={box}><BrokenIcon color="disabled" /></Box>;
    if (!url) return <Box sx={box}><CircularProgress size={20} /></Box>;
    return <Box component="img" src={url} alt={doc.title} sx={{ ...box, width: '100%', objectFit: 'cover', display: 'block' }} />;
};

interface DocumentThumbProps {
    doc: PatientDocument;
    onOpen: () => void;
    height?: number;
    /** Hide the kind/teeth line, e.g. in the narrow tooth drawer. */
    compact?: boolean;
}

const DocumentThumb: React.FC<DocumentThumbProps> = ({ doc, onOpen, height = 140, compact }) => {
    const { t } = useTranslation();
    return (
        <Card variant="outlined" sx={{ height: '100%' }}>
            <CardActionArea onClick={onOpen} sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }} aria-label={doc.title}>
                <DocumentPreview doc={doc} height={height} />
                <Box sx={{ p: 1, flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap title={doc.title}>{doc.title}</Typography>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                        {formatDate(doc.takenAt)}
                        {!compact && ` · ${t(`documents.kinds.${doc.kind}`)}`}
                        {!compact && doc.teeth.length > 0 && ` · ${t('dental.teeth')} ${doc.teeth.join(', ')}`}
                    </Typography>
                </Box>
            </CardActionArea>
        </Card>
    );
};

export default DocumentThumb;
