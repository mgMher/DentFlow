import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
    fullPage?: boolean;
    message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullPage = false, message }) => {
    const { t } = useTranslation();

    const content = (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
            <CircularProgress color="primary" />
            <Typography variant="body2" color="text.secondary">
                {message || t('common.loading')}
            </Typography>
        </Box>
    );

    if (fullPage) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                {content}
            </Box>
        );
    }

    return content;
};

export default LoadingSpinner;
