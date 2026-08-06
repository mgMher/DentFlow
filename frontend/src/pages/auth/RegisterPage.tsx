import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Link,
    IconButton,
    Menu,
    MenuItem,
    InputAdornment,
    CircularProgress,
    Alert,
    Grid,
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Language as LanguageIcon,
} from '@mui/icons-material';
import { RootState } from '../../store';
import { authActions } from '../../store/auth';
import { RegisterRequest } from '../../types';
import { LANGUAGES } from '../../utils/constants';

interface RegisterFormData extends RegisterRequest {
    confirmPassword: string;
}

const RegisterPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const isLoading = useSelector((state: RootState) =>
        state.http.loading.includes('REGISTER'),
    );
    const registerError = useSelector((state: RootState) =>
        state.http.errors.find((e) => e.type === 'REGISTER'),
    );
    const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [langAnchor, setLangAnchor] = React.useState<null | HTMLElement>(null);

    const {
        control,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<RegisterFormData>({
        defaultValues: {
            clinicName: '',
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            confirmPassword: '',
            phone: '',
        },
    });

    const passwordValue = watch('password');

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const onSubmit = (data: RegisterFormData) => {
        const { confirmPassword, ...registerData } = data;
        dispatch(authActions.register(registerData));
    };

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        localStorage.setItem('language', code);
        setLangAnchor(null);
    };

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
            {/* Language Switcher */}
            <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                <IconButton
                    onClick={(e) => setLangAnchor(e.currentTarget)}
                    sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
                >
                    <LanguageIcon />
                </IconButton>
                <Menu
                    anchorEl={langAnchor}
                    open={Boolean(langAnchor)}
                    onClose={() => setLangAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem
                            key={lang.code}
                            selected={i18n.language === lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                        >
                            <Typography sx={{ mr: 1 }}>{lang.flag}</Typography>
                            {lang.label}
                        </MenuItem>
                    ))}
                </Menu>
            </Box>

            <Card
                sx={{
                    width: '100%',
                    maxWidth: 520,
                    mx: 2,
                    borderRadius: 4,
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                }}
            >
                <CardContent sx={{ p: 5 }}>
                    {/* Branding */}
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                background: 'linear-gradient(135deg, #0B5E6E, #1A8A9E)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mx: 'auto',
                                mb: 2,
                            }}
                        >
                            <Typography
                                variant="h5"
                                sx={{ color: '#fff', fontWeight: 800, fontFamily: '"DM Sans"' }}
                            >
                                D
                            </Typography>
                        </Box>
                        <Typography
                            variant="h5"
                            fontWeight={700}
                            sx={{ color: '#1A2B3C', fontFamily: '"DM Sans"' }}
                        >
                            {t('app.name')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t('app.tagline')}
                        </Typography>
                    </Box>

                    {/* Title */}
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                        {t('auth.registerTitle')}
                    </Typography>

                    {/* Error Alert */}
                    {registerError && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                            {registerError.error}
                        </Alert>
                    )}

                    {/* Form */}
                    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                        {/* Clinic Name */}
                        <Controller
                            name="clinicName"
                            control={control}
                            rules={{ required: t('validation.required') }}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    label={t('auth.clinicName')}
                                    autoComplete="organization"
                                    autoFocus
                                    error={!!errors.clinicName}
                                    helperText={errors.clinicName?.message}
                                    disabled={isLoading}
                                    sx={{ mb: 2.5 }}
                                />
                            )}
                        />

                        {/* First Name + Last Name */}
                        <Grid container spacing={2} sx={{ mb: 2.5 }}>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="firstName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.firstName')}
                                            autoComplete="given-name"
                                            error={!!errors.firstName}
                                            helperText={errors.firstName?.message}
                                            disabled={isLoading}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="lastName"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.lastName')}
                                            autoComplete="family-name"
                                            error={!!errors.lastName}
                                            helperText={errors.lastName?.message}
                                            disabled={isLoading}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>

                        {/* Email */}
                        <Controller
                            name="email"
                            control={control}
                            rules={{
                                required: t('validation.required'),
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: t('validation.invalidEmail'),
                                },
                            }}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    label={t('auth.email')}
                                    type="email"
                                    autoComplete="email"
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                    disabled={isLoading}
                                    sx={{ mb: 2.5 }}
                                />
                            )}
                        />

                        {/* Phone */}
                        <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    fullWidth
                                    label={t('auth.phone')}
                                    type="tel"
                                    autoComplete="tel"
                                    error={!!errors.phone}
                                    helperText={errors.phone?.message}
                                    disabled={isLoading}
                                    sx={{ mb: 2.5 }}
                                />
                            )}
                        />

                        {/* Password + Confirm Password */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="password"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        minLength: {
                                            value: 8,
                                            message: t('validation.passwordMin'),
                                        },
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.password')}
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            error={!!errors.password}
                                            helperText={errors.password?.message}
                                            disabled={isLoading}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Controller
                                    name="confirmPassword"
                                    control={control}
                                    rules={{
                                        required: t('validation.required'),
                                        validate: (value) =>
                                            value === passwordValue || t('validation.passwordMatch'),
                                    }}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            fullWidth
                                            label={t('auth.confirmPassword')}
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            error={!!errors.confirmPassword}
                                            helperText={errors.confirmPassword?.message}
                                            disabled={isLoading}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={isLoading}
                            sx={{
                                py: 1.5,
                                fontSize: '1rem',
                                fontWeight: 600,
                                borderRadius: 2,
                                background: 'linear-gradient(135deg, #0B5E6E, #1A8A9E)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #074750, #0B5E6E)',
                                },
                            }}
                        >
                            {isLoading ? (
                                <CircularProgress size={24} sx={{ color: '#fff' }} />
                            ) : (
                                t('auth.registerClinic')
                            )}
                        </Button>

                        <Box sx={{ textAlign: 'center', mt: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                                {t('auth.hasAccount')}{' '}
                                <Link
                                    component={RouterLink}
                                    to="/login"
                                    underline="hover"
                                    sx={{ fontWeight: 600, color: 'primary.main' }}
                                >
                                    {t('auth.login')}
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default RegisterPage;
