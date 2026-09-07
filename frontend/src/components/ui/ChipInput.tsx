import React, { useState } from 'react';
import { Box, Chip, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ChipInputProps {
    /** Tolerates `undefined` so it can be driven by an uninitialised form field. */
    value?: string[] | null;
    onChange: (val: string[]) => void;
    label: string;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Free-text list editor. Values are added with Enter or the "+" button and
 * removed from the chip below the field.
 */
const ChipInput: React.FC<ChipInputProps> = ({
    value,
    onChange,
    label,
    placeholder,
    disabled,
}) => {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');

    const chips = value ?? [];

    const addChip = () => {
        const next = inputValue.trim();
        if (!next) return;
        if (!chips.includes(next)) {
            onChange([...chips, next]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addChip();
        }
    };

    const handleDelete = (chipToDelete: string) => {
        onChange(chips.filter((chip) => chip !== chipToDelete));
    };

    return (
        <Box>
            <TextField
                fullWidth
                size="small"
                label={label}
                placeholder={placeholder || label}
                value={inputValue}
                disabled={disabled}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addChip}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <Tooltip title={t('common.add')}>
                                <IconButton
                                    size="small"
                                    edge="end"
                                    onClick={addChip}
                                    disabled={disabled || !inputValue.trim()}
                                    aria-label={t('common.add')}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </InputAdornment>
                    ),
                }}
            />
            {chips.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {chips.map((chip) => (
                        <Chip
                            key={chip}
                            label={chip}
                            size="small"
                            onDelete={disabled ? undefined : () => handleDelete(chip)}
                            sx={{
                                maxWidth: '100%',
                                height: 'auto',
                                py: 0.25,
                                '& .MuiChip-label': {
                                    whiteSpace: 'normal',
                                    overflowWrap: 'anywhere',
                                },
                            }}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default ChipInput;
