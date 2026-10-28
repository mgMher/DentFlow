import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';

/**
 * Run a data fix once per database, recorded in the `migrations` collection.
 *
 * Startup fixes used to re-run on every boot: full collection scans, and the
 * same warnings (with patient phone numbers in them) logged again and again.
 * A failure is logged and not recorded, so it is retried on the next start.
 *
 * `fix` returns how many documents it changed, for the record.
 */
export async function runOnce(
    connection: Connection,
    id: string,
    logger: Logger,
    fix: () => Promise<number>,
): Promise<void> {
    const migrations = connection.collection<{ _id: string; ranAt: Date; documents: number }>('migrations');
    try {
        if (await migrations.findOne({ _id: id })) return;
        const documents = await fix();
        await migrations.insertOne({ _id: id, ranAt: new Date(), documents });
    } catch (err) {
        logger.error(`Migration ${id} failed (will retry next start): ${(err as Error).message}`);
    }
}
