import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, CircularProgress, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { Description as CsvIcon, Download as DownloadIcon, GridOn as ExcelIcon } from '@mui/icons-material';
import { apiErrorMessage } from '../../utils/apiError';
import { downloadExport, ExportFormat, ExportSheet } from '../../utils/exportTable';

interface ExportMenuProps {
    filename: string;
    /** Built when clicked, from what the page shows. */
    sheets: () => ExportSheet[];
    moneyDecimals?: number;
    disabled?: boolean;
}

/** F11: "Export" → Excel or CSV. */
const ExportMenu: React.FC<ExportMenuProps> = ({ filename, sheets, moneyDecimals, disabled }) => {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (format: ExportFormat) => {
        setAnchor(null);
        setBusy(true);
        try {
            await downloadExport(format, filename, sheets(), moneyDecimals);
        } catch (err) {
            toast.error(apiErrorMessage(err, 'exports.failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button
                variant="outlined"
                startIcon={busy ? <CircularProgress size={16} /> : <DownloadIcon />}
                disabled={disabled || busy}
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{ displayPrint: 'none' }}
            >
                {t('exports.export')}
            </Button>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => run('xlsx')}>
                    <ListItemIcon><ExcelIcon fontSize="small" /></ListItemIcon>
                    {t('exports.excel')}
                </MenuItem>
                <MenuItem onClick={() => run('csv')}>
                    <ListItemIcon><CsvIcon fontSize="small" /></ListItemIcon>
                    {t('exports.csv')}
                </MenuItem>
            </Menu>
        </>
    );
};

export default ExportMenu;
