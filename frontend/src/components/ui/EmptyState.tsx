import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon, SearchOff as EmptyIcon } from '@mui/icons-material';

interface EmptyStateProps {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, actionLabel, onAction, icon }) => {
    return (
        <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', py: 8, textAlign: 'center',
        }}>
            <Box sx={{ mb: 2, color: 'text.secondary', opacity: 0.5 }}>
                {icon || <EmptyIcon sx={{ fontSize: 64 }} />}
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400 }}>
                    {description}
                </Typography>
            )}
            {actionLabel && onAction && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </Box>
    );
};

export default EmptyState;
