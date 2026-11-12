/**
 * What may be uploaded, recognised from the file's first bytes rather than
 * its name or the browser's claim — a renamed .exe is not an X-ray.
 */
export interface FileType {
    mimeType: string;
    /** Browsers can show it inline (images, PDF); DICOM is download-only. */
    viewable: boolean;
}

const starts = (data: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => data[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export const detectFileType = (data: Uint8Array): FileType | null => {
    if (starts(data, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', viewable: true };
    if (starts(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: 'image/png', viewable: true };
    if (starts(data, ascii('RIFF')) && starts(data, ascii('WEBP'), 8)) return { mimeType: 'image/webp', viewable: true };
    if (starts(data, ascii('%PDF-'))) return { mimeType: 'application/pdf', viewable: true };
    // DICOM: 128-byte preamble, then "DICM".
    if (data.length > 132 && starts(data, ascii('DICM'), 128)) return { mimeType: 'application/dicom', viewable: false };
    return null;
};

export const maxUploadBytes = () => (Number(process.env.DOCUMENTS_MAX_MB) || 20) * 1024 * 1024;
