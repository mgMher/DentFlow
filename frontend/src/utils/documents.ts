import { useEffect, useState } from 'react';
import api from '../api/axios';
import { DocumentKind, PatientDocument } from '../types';

export const DOCUMENT_KINDS: DocumentKind[] = ['xray', 'photo', 'consent', 'referral', 'lab', 'other'];
export const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,application/pdf,application/dicom,.dcm';

export const isImage = (doc: Pick<PatientDocument, 'file'>) => doc.file.mimeType.startsWith('image/');
export const isPdf = (doc: Pick<PatientDocument, 'file'>) => doc.file.mimeType === 'application/pdf';

export const fileSize = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Files come only through the API (with the user's token), so an <img> cannot
 * point at them directly: they are fetched as blobs and shown through object
 * URLs. The last few are kept so going back and forth does not refetch.
 */
const cache = new Map<string, Promise<string>>();
const CACHE_SIZE = 40;

export const documentUrl = (id: string): Promise<string> => {
    const hit = cache.get(id);
    if (hit) {
        cache.delete(id);
        cache.set(id, hit);
        return hit;
    }
    const url = api.get(`/documents/${id}/file`, { responseType: 'blob' }).then((res) => URL.createObjectURL(res.data as Blob));
    url.catch(() => cache.delete(id));
    cache.set(id, url);
    while (cache.size > CACHE_SIZE) {
        const [oldest, old] = cache.entries().next().value as [string, Promise<string>];
        cache.delete(oldest);
        old.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    }
    return url;
};

/** `null` while loading or when not wanted; `'error'` when the file could not be fetched. */
export const useDocumentUrl = (id: string | null | undefined, wanted = true) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!id || !wanted) return;
        let live = true;
        setUrl(null);
        documentUrl(id)
            .then((u) => live && setUrl(u))
            .catch(() => live && setUrl('error'));
        return () => {
            live = false;
        };
    }, [id, wanted]);
    return url;
};

/** Save the file under its original name. */
export const downloadDocument = async (doc: Pick<PatientDocument, '_id' | 'file'>) => {
    const url = await documentUrl(doc._id);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file.originalName;
    a.click();
};
