import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Schema, Types } from 'mongoose';
import { runOnce } from './run-once';

const MIGRATION_ID = '2026-10-28-objectid-repair';
const HEX_ID = /^[0-9a-f]{24}$/i;

type Raw = Record<string, any>;

const getPath = (obj: Raw, path: string) => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), obj);

const setPath = (obj: Raw, path: string, value: unknown) => {
    const keys = path.split('.');
    const last = keys.pop()!;
    const parent = keys.reduce<any>((o, k) => (o == null ? o : o[k]), obj);
    if (parent != null) parent[last] = value;
};

const toId = (v: unknown) => (typeof v === 'string' && HEX_ID.test(v) ? new Types.ObjectId(v) : v);

/** Every path in `schema` that should hold an ObjectId, as query paths (dots through arrays and subdocuments). */
const objectIdPaths = (schema: Schema, prefix = ''): string[] => {
    const out: string[] = [];
    schema.eachPath((path, type: any) => {
        if (path === '_id') return;
        if (type.instance === 'ObjectId') out.push(prefix + path);
        else if (type.instance === 'Array' && type.caster?.instance === 'ObjectId') out.push(prefix + path);
        if (type.schema) out.push(...objectIdPaths(type.schema, `${prefix}${path}.`));
    });
    return out;
};

/** Convert hex strings to ObjectIds in place; returns whether anything changed. */
const repair = (doc: Raw, schema: Schema): boolean => {
    let changed = false;
    schema.eachPath((path, type: any) => {
        if (path === '_id') return;
        const value = getPath(doc, path);
        if (value == null) return;

        if (type.instance === 'ObjectId') {
            const fixed = toId(value);
            if (fixed !== value) {
                setPath(doc, path, fixed);
                changed = true;
            }
        } else if (type.instance === 'Array' && type.caster?.instance === 'ObjectId' && Array.isArray(value)) {
            const fixed = value.map(toId);
            if (fixed.some((v, i) => v !== value[i])) {
                setPath(doc, path, fixed);
                changed = true;
            }
        } else if (type.schema) {
            for (const sub of Array.isArray(value) ? value : [value]) {
                if (sub && typeof sub === 'object' && repair(sub, type.schema)) changed = true;
            }
        }
    });
    return changed;
};

/**
 * One-off repair for references stored as strings.
 *
 * Every schema declared its references as `type: Types.ObjectId`. With
 * @nestjs/mongoose 9 + Mongoose 7 that silently makes the field `Mixed`, so
 * nothing was ever cast: documents written through the API (where `clinicId`
 * comes from the JWT as a string) stored strings, while seeded ones stored
 * ObjectIds — and each kind of query only matched one of them. The schemas
 * now use `Schema.Types.ObjectId`; this converts the strings already stored.
 *
 * Runs once per database (recorded in `migrations`), and is idempotent anyway.
 */
@Injectable()
export class ObjectIdRepairService implements OnModuleInit {
    private readonly logger = new Logger(ObjectIdRepairService.name);

    constructor(@InjectConnection() private readonly connection: Connection) {}

    async onModuleInit(): Promise<void> {
        await runOnce(this.connection, MIGRATION_ID, this.logger, async () => {
            let total = 0;
            for (const model of Object.values(this.connection.models)) {
                const paths = objectIdPaths(model.schema);
                if (!paths.length) continue;

                const cursor = model.collection.find({ $or: paths.map((p) => ({ [p]: { $type: 'string' } })) });
                let fixed = 0;
                for await (const doc of cursor) {
                    if (repair(doc, model.schema)) {
                        await model.collection.replaceOne({ _id: doc._id }, doc);
                        fixed++;
                    }
                }
                if (fixed) this.logger.log(`Converted string ids to ObjectIds in ${fixed} ${model.collection.name} document(s)`);
                total += fixed;
            }
            return total;
        });
    }
}
