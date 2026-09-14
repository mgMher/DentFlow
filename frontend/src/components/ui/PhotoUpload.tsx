import React, { useRef, useState } from 'react';
import { Avatar, Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import {
    PhotoCamera as PhotoCameraIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
// Large enough for the biggest avatar we render (72px) on a 2x display, and
// small enough that photos can ride along in list responses (~8KB each).
const OUTPUT_SIZE = 192;

/**
 * Downscale and re-encode the picked file to a square JPEG data URL, so photos
 * stay a few KB regardless of what the camera produced.
 */
const toResizedDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read-failed'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('decode-failed'));
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = OUTPUT_SIZE;
                canvas.height = OUTPUT_SIZE;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('canvas-unavailable'));
                    return;
                }

                // Center-crop to a square before scaling, so faces are not squashed.
                const side = Math.min(image.width, image.height);
                ctx.drawImage(
                    image,
                    (image.width - side) / 2,
                    (image.height - side) / 2,
                    side,
                    side,
                    0,
                    0,
                    OUTPUT_SIZE,
                    OUTPUT_SIZE,
                );

                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            image.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });

interface PhotoUploadProps {
    value?: string | null;
    onChange: (dataUrl: string | null) => void;
    initials?: string;
    size?: number;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
    value,
    onChange,
    initials,
    size = 96,
}) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Allow re-picking the same file after a removal.
        event.target.value = '';
        if (!file) return;

        setError(null);

        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError(t('patients.photoTypeError'));
            return;
        }
        if (file.size > MAX_SOURCE_BYTES) {
            setError(t('patients.photoSizeError'));
            return;
        }

        try {
            onChange(await toResizedDataUrl(file));
        } catch {
            setError(t('patients.photoReadError'));
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ position: 'relative' }}>
                <Avatar
                    src={value || undefined}
                    sx={{
                        width: size,
                        height: size,
                        fontSize: size / 3,
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                    }}
                >
                    {initials}
                </Avatar>
                {value && (
                    <Tooltip title={t('patients.removePhoto')}>
                        <IconButton
                            size="small"
                            onClick={() => onChange(null)}
                            sx={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': { bgcolor: 'background.paper' },
                            }}
                        >
                            <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PhotoCameraIcon />}
                    onClick={() => inputRef.current?.click()}
                >
                    {value ? t('patients.changePhoto') : t('patients.uploadPhoto')}
                </Button>
                <Typography
                    variant="caption"
                    color={error ? 'error' : 'text.secondary'}
                    sx={{ display: 'block', mt: 0.5 }}
                >
                    {error || t('patients.photoHint')}
                </Typography>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    hidden
                    onChange={handlePick}
                />
            </Box>
        </Box>
    );
};

export default PhotoUpload;
