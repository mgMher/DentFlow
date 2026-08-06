import { createTheme, ThemeOptions } from '@mui/material/styles';

const commonTheme: ThemeOptions = {
    typography: {
        fontFamily: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
        h1: { fontWeight: 700, fontSize: '2rem' },
        h2: { fontWeight: 700, fontSize: '1.75rem' },
        h3: { fontWeight: 600, fontSize: '1.5rem' },
        h4: { fontWeight: 600, fontSize: '1.25rem' },
        h5: { fontWeight: 600, fontSize: '1.1rem' },
        h6: { fontWeight: 600, fontSize: '1rem' },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 600,
                },
                containedPrimary: {
                    boxShadow: '0 2px 8px rgba(11, 94, 110, 0.3)',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(11, 94, 110, 0.4)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 700,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    borderRight: 'none',
                },
            },
        },
    },
};

export const lightTheme = createTheme({
    ...commonTheme,
    palette: {
        mode: 'light',
        primary: {
            main: '#0B5E6E',
            light: '#1A8A9E',
            dark: '#074750',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#C9A84C',
            light: '#D4BC73',
            dark: '#A88A3A',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#F5F7FA',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#1A2B3C',
            secondary: '#5A6B7C',
        },
        error: {
            main: '#E53E3E',
        },
        warning: {
            main: '#ED8936',
        },
        success: {
            main: '#38A169',
        },
        info: {
            main: '#3182CE',
        },
        divider: '#E8ECF0',
    },
});

export const darkTheme = createTheme({
    ...commonTheme,
    palette: {
        mode: 'dark',
        primary: {
            main: '#1A8A9E',
            light: '#2BB0C8',
            dark: '#0B5E6E',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#D4BC73',
            light: '#E0D09A',
            dark: '#C9A84C',
            contrastText: '#1A2B3C',
        },
        background: {
            default: '#0F1923',
            paper: '#1A2B3C',
        },
        text: {
            primary: '#E8ECF0',
            secondary: '#9AABB8',
        },
        error: {
            main: '#FC8181',
        },
        warning: {
            main: '#F6AD55',
        },
        success: {
            main: '#68D391',
        },
        info: {
            main: '#63B3ED',
        },
        divider: '#2D3E4F',
    },
});
