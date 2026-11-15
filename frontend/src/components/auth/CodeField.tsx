import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@mui/material';

interface CodeFieldProps {
    value: string;
    onChange: (value: string) => void;
    onEnter?: () => void;
    autoFocus?: boolean;
    /** A backup code (letters and a dash) instead of 6 digits. */
    backup?: boolean;
}

/** The authenticator code: digits only, the phone's one-time-code autofill. */
const CodeField: React.FC<CodeFieldProps> = ({ value, onChange, onEnter, autoFocus, backup }) => {
    const { t } = useTranslation();
    return (
        <TextField
            fullWidth
            autoFocus={autoFocus}
            label={t(backup ? 'security.backupCode' : 'security.code')}
            value={value}
            onChange={(e) => onChange(backup ? e.target.value.slice(0, 20) : e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
            placeholder={backup ? 'abcde-fghij' : '123456'}
            inputProps={{
                inputMode: backup ? 'text' : 'numeric',
                autoComplete: 'one-time-code',
                style: { fontFamily: 'monospace', fontSize: '1.4rem', letterSpacing: backup ? '0.1em' : '0.4em', textAlign: 'center' },
                'data-testid': 'two-factor-code',
            }}
        />
    );
};

export default CodeField;
