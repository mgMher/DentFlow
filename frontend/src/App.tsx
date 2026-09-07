import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { store } from './store';
import { AppRouter } from './router';
import { useThemeMode } from './hooks';
import { lightTheme, darkTheme } from './utils/theme';
import HttpToastHandler from './components/HttpToastHandler';
import './locales/i18n';

const AppContent: React.FC = () => {
    const { mode, toggleTheme } = useThemeMode();
    const theme = mode === 'dark' ? darkTheme : lightTheme;

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <BrowserRouter>
                <AppRouter themeMode={mode} onToggleTheme={toggleTheme} />
            </BrowserRouter>
            <HttpToastHandler />
            <ToastContainer
                position="top-center"
                autoClose={3500}
                hideProgressBar
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss={false}
                draggable={false}
                pauseOnHover={false}
            />
        </ThemeProvider>
    );
};

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <AppContent />
        </Provider>
    );
};

export default App;
