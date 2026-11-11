import React from 'react';
import { Chip, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ToothStatus } from '../../types';
import { TOOTH_STATUS_COLORS, toothStatusKey } from '../../utils/dental';

/** A tooth status in the chart's own colours. */
const ToothStatusChip: React.FC<{ status: ToothStatus }> = ({ status }) => {
    const { t } = useTranslation();
    const color = status === 'healthy' ? '#38A169' : TOOTH_STATUS_COLORS[status];
    return (
        <Chip
            size="small"
            label={t(toothStatusKey(status))}
            sx={{ bgcolor: alpha(color, 0.15), color, border: `1px solid ${alpha(color, 0.5)}`, fontWeight: 600 }}
        />
    );
};

export default ToothStatusChip;
