import { FilterQuery } from 'mongoose';
import { escapeRegex } from 'src/common/utils';
import { PatientDocument } from './patient.schema';

/**
 * "Armen Hakobyan" → every word must match some field. A single regex over
 * the whole string matched nothing, because no one field holds both names.
 * Used by the patient list and the invoice search.
 */
export const patientSearchClauses = (search: string): FilterQuery<PatientDocument>[] =>
    search
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .map((word) => {
            const regex = new RegExp(escapeRegex(word), 'i');
            const or: FilterQuery<PatientDocument>[] = [
                { firstName: regex },
                { lastName: regex },
                { patronymic: regex },
                { email: regex },
                { phone: regex },
            ];
            // Let "093123456" or "93123456" match the stored +374XXXXXXXX form.
            const digits = word.replace(/\D/g, '');
            if (digits.length >= 3) or.push({ phone: new RegExp(digits.replace(/^(?:374|0)/, '')) });
            return { $or: or };
        });
