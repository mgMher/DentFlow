import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    actionIcon?: React.ReactNode;
    children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title, subtitle, actionLabel, onAction, actionIcon, children,
}) => {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
                <Typography variant="h4" fontWeight={700}>{title}</Typography>
                {subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {children}
                {actionLabel && onAction && (
                    <Button variant="contained" startIcon={actionIcon || <AddIcon />} onClick={onAction}>
                        {actionLabel}
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export default PageHeader;
