import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { useTranslation } from 'react-i18next';


export interface StatusChipProps extends Omit<ChipProps, 'label'> {
    status: string;
    translationPrefix?: string;
    label?: string;
}

const statusColorMap: Record<string, { bg: string; color: string }> = {
    scheduled: { bg: '#EBF4FF', color: '#3182CE' },
    confirmed: { bg: '#F0FFF4', color: '#38A169' },
    in_progress: { bg: '#FFFAF0', color: '#ED8936' },
    completed: { bg: '#E6FFFA', color: '#0B5E6E' },
    cancelled: { bg: '#FFF5F5', color: '#E53E3E' },
    no_show: { bg: '#F7FAFC', color: '#A0AEC0' },
    draft: { bg: '#F7FAFC', color: '#A0AEC0' },
    pending: { bg: '#FFFAF0', color: '#ED8936' },
    partial: { bg: '#EBF4FF', color: '#3182CE' },
    paid: { bg: '#F0FFF4', color: '#38A169' },
    overdue: { bg: '#FFF5F5', color: '#E53E3E' },
    active: { bg: '#F0FFF4', color: '#38A169' },
    inactive: { bg: '#F7FAFC', color: '#A0AEC0' },
    archived: { bg: '#FAF5FF', color: '#805AD5' },
    deceased: { bg: '#EDF2F7', color: '#4A5568' },
    healthy: { bg: '#F0FFF4', color: '#38A169' },
    filled: { bg: '#EBF4FF', color: '#3182CE' },
    crown: { bg: '#FFFFF0', color: '#D69E2E' },
    missing: { bg: '#F7FAFC', color: '#A0AEC0' },
    implant: { bg: '#FAF5FF', color: '#805AD5' },
    needs_treatment: { bg: '#FFF5F5', color: '#E53E3E' },
    root_canal: { bg: '#FFFAF0', color: '#ED8936' },
    decayed: { bg: '#FFF5F5', color: '#C53030' },
    bridge: { bg: '#EBF8FF', color: '#2B6CB0' },
    veneer: { bg: '#E6FFFA', color: '#319795' },
};

const StatusChip: React.FC<StatusChipProps> = ({ status, translationPrefix = 'appointments', label: customLabel, ...props }) => {
    const { t } = useTranslation();
    const colors = statusColorMap[status] || { bg: '#F7FAFC', color: '#A0AEC0' };
    const label = customLabel || t(`${translationPrefix}.${status}`, status);

    return (
        <Chip
            label={label}
            size="small"
            sx={{
                backgroundColor: colors.bg,
                color: colors.color,
                fontWeight: 600,
                fontSize: 12,
                ...props.sx,
            }}
            {...props}
        />
    );
};

export default StatusChip;
