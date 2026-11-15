import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardContent, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { LANGUAGES } from '../../utils/constants';

/** The signed-out pages' frame (F9: forgot / reset password), same look as the login page. */
const AuthShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => {
    const { t, i18n } = useTranslation();
    const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #074750 0%, #0B5E6E 40%, #1A8A9E 100%)',
                position: 'relative',
                py: 4,
            }}
        >
            <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                <IconButton onClick={(e) => setLangAnchor(e.currentTarget)} sx={{ color: 'rgba(255, 255, 255, 0.9)' }} aria-label={t('settings.language')}>
                    <LanguageIcon />
                </IconButton>
                <Menu anchorEl={langAnchor} open={Boolean(langAnchor)} onClose={() => setLangAnchor(null)}>
                    {LANGUAGES.map((lang) => (
                        <MenuItem
                            key={lang.code}
                            selected={i18n.language === lang.code}
                            onClick={() => {
                                i18n.changeLanguage(lang.code);
                                localStorage.setItem('language', lang.code);
                                setLangAnchor(null);
                            }}
                        >
                            <Typography sx={{ mr: 1 }}>{lang.flag}</Typography>
                            {lang.label}
                        </MenuItem>
                    ))}
                </Menu>
            </Box>
            <Card sx={{ width: '100%', maxWidth: 440, mx: 2, borderRadius: 4, boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)' }}>
                <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 3,
                                background: 'linear-gradient(135deg, #0B5E6E, #1A8A9E)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 1.5,
                            }}
                        >
                            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, fontFamily: '"DM Sans"' }}>D</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700} sx={{ color: '#1A2B3C', fontFamily: '"DM Sans"' }}>{t('app.name')}</Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>{title}</Typography>
                    {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>}
                    {children}
                </CardContent>
            </Card>
        </Box>
    );
};

export default AuthShell;
