import React from 'react';
import { Card, CardContent, Typography, Box, useTheme } from '@mui/material';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
    trend?: { value: number; label: string };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend }) => {
    const theme = useTheme();
    const bgColor = color || theme.palette.primary.main;

    return (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            {title}
                        </Typography>
                        <Typography variant="h4" fontWeight={700}>
                            {value}
                        </Typography>
                        {trend && (
                            <Typography
                                variant="caption"
                                sx={{ color: trend.value >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
                            >
                                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{
                        width: 48, height: 48, borderRadius: 3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: `${bgColor}14`, color: bgColor,
                    }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default StatCard;
