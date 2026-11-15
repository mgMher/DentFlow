import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { ContentCopy as CopyIcon, Download as DownloadIcon } from '@mui/icons-material';

/** The 10 backup codes, shown once (F9): copy or save them before going on. */
const BackupCodes: React.FC<{ codes: string[]; onDone: () => void; doneLabel?: string }> = ({ codes, onDone, doneLabel }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const text = `DentFlow — ${t('security.backupCodes')}\n\n${codes.join('\n')}\n`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };
    const download = () => {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dentflow-backup-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>{t('security.backupCodesHint')}</Alert>
            <Box
                data-testid="backup-codes"
                sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2, fontFamily: 'monospace', mb: 2 }}
            >
                {codes.map((c) => (
                    <Typography key={c} sx={{ fontFamily: 'inherit', textAlign: 'center' }}>{c}</Typography>
                ))}
            </Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<CopyIcon />} onClick={copy}>
                    {copied ? t('security.copied') : t('security.copy')}
                </Button>
                <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={download}>{t('security.download')}</Button>
            </Stack>
            <Button fullWidth variant="contained" onClick={onDone}>{doneLabel ?? t('security.savedThem')}</Button>
        </Box>
    );
};

export default BackupCodes;
