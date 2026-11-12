import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, join, resolve, sep } from 'path';
import { Readable } from 'stream';

/**
 * Where uploaded files live. Local disk under `UPLOAD_DIR` for now; the
 * interface is small so an object store (S3, MinIO) can replace it. Keys are
 * generated here — never from a user's file name — and always stay inside
 * the root.
 */
@Injectable()
export class FileStorageService {
    private root() {
        return resolve(process.env.UPLOAD_DIR || './uploads');
    }

    private pathOf(key: string) {
        const root = this.root();
        const path = resolve(root, key);
        if (path !== root && !path.startsWith(root + sep)) throw new Error('Storage key outside the upload directory');
        return path;
    }

    /** Store bytes under `<clinic>/<yyyy>/<mm>/<uuid>`; written to a temp file, then renamed, so a reader never sees half a file. */
    async put(clinicId: string, data: Uint8Array): Promise<string> {
        const now = new Date();
        const key = join(clinicId, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), randomUUID());
        const path = this.pathOf(key);
        await mkdir(dirname(path), { recursive: true });
        const temp = `${path}.part`;
        await writeFile(temp, data, { flag: 'wx' });
        await rename(temp, path);
        return key;
    }

    async open(key: string): Promise<{ stream: Readable; size: number }> {
        const path = this.pathOf(key);
        const { size } = await stat(path);
        return { stream: createReadStream(path), size };
    }

    /** Only for a write that must be undone (the database refused the record). Removed records keep their files. */
    async remove(key: string): Promise<void> {
        await rm(this.pathOf(key), { force: true });
    }
}
