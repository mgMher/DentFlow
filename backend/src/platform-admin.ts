/**
 * F13: create the first platform admin (or give an existing one a new link).
 *
 *   npm run platform:admin -- you@example.com First Last
 *
 * Prints a one-time link (valid 24 hours) to choose the password; nobody,
 * including whoever runs this, ever sees it. More admins can then be added
 * from the platform console.
 */
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { createHash, randomBytes } from 'crypto';
import { User, UserSchema } from './modules/auth/auth.schema';

dotenv.config();

const LINK_HOURS = 24;

async function main() {
    const [email, firstName = '', lastName = ''] = process.argv.slice(2);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        console.error('Usage: npm run platform:admin -- <email> [first name] [last name]');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dentflow');
    const Users = mongoose.model(User.name, UserSchema);
    const address = email.toLowerCase();

    let user = await Users.findOne({ email: address });
    if (user && (user.role !== 'super_admin' || user.clinicId)) {
        console.error(`${address} already belongs to a clinic account; use another email.`);
        process.exit(1);
    }
    if (!user) {
        user = await Users.create({
            email: address,
            password: await bcrypt.hash(randomBytes(32).toString('base64url'), 12),
            role: 'super_admin',
            firstName,
            lastName,
        });
        console.log(`Created platform admin ${address}.`);
    } else {
        await Users.updateOne({ _id: user._id }, { $set: { isActive: true } });
        console.log(`${address} is already a platform admin; here is a new link.`);
    }

    const token = randomBytes(32).toString('base64url');
    await Users.updateOne(
        { _id: user._id },
        {
            $set: {
                resetTokenHash: createHash('sha256').update(token).digest('hex'),
                resetTokenExpiresAt: new Date(Date.now() + LINK_HOURS * 3_600_000),
            },
        },
    );
    const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    console.log(`\nChoose the password here (one use, ${LINK_HOURS} hours):\n${base}/reset-password?token=${token}\n`);
    console.log('Two-factor sign-in is required for platform admins; it is set up at the first sign-in.');
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
