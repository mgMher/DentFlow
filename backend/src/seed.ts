import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dentflow';

// Schemas (inline for seed script)
const ClinicSchema = new mongoose.Schema({
    name: String,
    address: { street: String, city: String, state: String, zipCode: String, country: String },
    phone: String,
    email: String,
    workingHours: [{ dayOfWeek: Number, startTime: String, endTime: String, isOpen: Boolean }],
    timezone: { type: String, default: 'Asia/Yerevan' },
    language: { type: String, default: 'hy' },
    currency: { type: String, default: 'AMD' },
    subscription: { plan: String, status: String, expiresAt: Date },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const AuthSchema = new mongoose.Schema({
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    role: String,
    firstName: String,
    lastName: String,
    patronymic: String,
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    refreshToken: String,
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    authId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth' },
    firstName: String,
    lastName: String,
    patronymic: String,
    email: String,
    phone: String,
    role: String,
    specialization: String,
    licenseNumber: String,
    isActive: { type: Boolean, default: true },
    schedule: { defaultAvailability: [{ dayOfWeek: Number, startTime: String, endTime: String }] },
}, { timestamps: true });

const PatientSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    firstName: String,
    lastName: String,
    patronymic: String,
    dateOfBirth: Date,
    gender: String,
    phone: String,
    email: String,
    address: { street: String, city: String, state: String, zipCode: String, country: String },
    medicalHistory: { conditions: [String], allergies: [String], medications: [String], notes: String },
    status: { type: String, default: 'active' },
    isActive: { type: Boolean, default: true },
    lastVisit: Date,
}, { timestamps: true });

const TreatmentSchema = new mongoose.Schema({
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    name: String,
    nameHy: String,
    nameRu: String,
    category: String,
    description: String,
    code: String,
    duration: Number,
    price: { amount: Number, currency: String },
    isCustom: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

async function seed() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const Clinic = mongoose.model('Clinic', ClinicSchema);
    const Auth = mongoose.model('Auth', AuthSchema);
    const User = mongoose.model('User', UserSchema);
    const Patient = mongoose.model('Patient', PatientSchema);
    const Treatment = mongoose.model('Treatment', TreatmentSchema);

    // Clear existing data
    await Promise.all([
        Clinic.deleteMany({}),
        Auth.deleteMany({}),
        User.deleteMany({}),
        Patient.deleteMany({}),
        Treatment.deleteMany({}),
    ]);
    console.log('Cleared existing data.');

    // Create clinic
    const clinic = await Clinic.create({
        name: '\u0531\u0580\u0561\u0580\u0561\u057F \u0531\u057F\u0561\u0574\u0576\u0561\u0562\u0578\u0582\u056A\u0561\u0580\u0561\u0576',
        address: {
            street: '\u0544\u0561\u0577\u057F\u0578\u0581\u056B 42',
            city: '\u0535\u0580\u0587\u0561\u0576',
            state: '\u0535\u0580\u0587\u0561\u0576',
            zipCode: '0010',
            country: '\u0540\u0561\u0575\u0561\u057D\u057F\u0561\u0576',
        },
        phone: '+37410123456',
        email: 'info@ararat-dental.am',
        workingHours: [
            { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOpen: false },
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true },
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true },
            { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: true },
            { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isOpen: true },
            { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true },
            { dayOfWeek: 6, startTime: '10:00', endTime: '15:00', isOpen: true },
        ],
        timezone: 'Asia/Yerevan',
        language: 'hy',
        currency: 'AMD',
        subscription: { plan: 'professional', status: 'active', expiresAt: new Date('2027-01-01') },
    });
    console.log('Created clinic:', clinic.name);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminAuth = await Auth.create({
        email: 'admin@ararat-dental.am',
        password: adminPassword,
        clinicId: clinic._id,
        role: 'clinic_admin',
        firstName: '\u0531\u0580\u0574\u0561\u0576',
        lastName: '\u054A\u0565\u057F\u0580\u0578\u057D\u0575\u0561\u0576',
        isActive: true,
    });
    const adminUser = await User.create({
        clinicId: clinic._id,
        authId: adminAuth._id,
        firstName: '\u0531\u0580\u0574\u0561\u0576',
        lastName: '\u054A\u0565\u057F\u0580\u0578\u057D\u0575\u0561\u0576',
        email: 'admin@ararat-dental.am',
        phone: '+37491123456',
        role: 'clinic_admin',
        isActive: true,
    });
    console.log('Created admin:', adminAuth.email);

    // Create dentists
    const dentists = [
        {
            firstName: '\u0531\u0576\u056B',
            lastName: '\u0540\u0561\u0575\u0580\u0561\u057A\u0565\u057F\u0575\u0561\u0576',
            patronymic: '\u054D\u0565\u0580\u0563\u0565\u0575\u056B',
            email: 'ani.hayrapetyan@ararat-dental.am',
            phone: '+37493123456',
            specialization: '\u0539\u0565\u0580\u0561\u057A\u0587\u057F',
            licenseNumber: 'DL-2024-001',
        },
        {
            firstName: '\u0531\u0580\u057F\u0561\u056F',
            lastName: '\u0542\u0580\u056B\u0563\u0578\u0580\u0575\u0561\u0576',
            patronymic: '\u0540\u0561\u0575\u056F\u056B',
            email: 'artak.grigoryan@ararat-dental.am',
            phone: '+37494123456',
            specialization: '\u0555\u0580\u0569\u0578\u0564\u0578\u0576\u057F',
            licenseNumber: 'DL-2024-002',
        },
        {
            firstName: '\u0544\u0561\u0580\u056B\u0561\u0574',
            lastName: '\u054D\u0561\u0580\u0563\u057D\u0575\u0561\u0576',
            patronymic: '\u0531\u0580\u0574\u0565\u0576\u056B',
            email: 'mariam.sargsyan@ararat-dental.am',
            phone: '+37495123456',
            specialization: '\u0544\u0561\u0576\u056F\u0561\u0562\u0578\u0582\u056A\u0561\u0580\u0561\u0576',
            licenseNumber: 'DL-2024-003',
        },
    ];

    for (const d of dentists) {
        const pass = await bcrypt.hash('dentist123', 10);
        const auth = await Auth.create({
            email: d.email,
            password: pass,
            clinicId: clinic._id,
            role: 'dentist',
            firstName: d.firstName,
            lastName: d.lastName,
            patronymic: d.patronymic,
            isActive: true,
        });
        await User.create({
            clinicId: clinic._id,
            authId: auth._id,
            firstName: d.firstName,
            lastName: d.lastName,
            patronymic: d.patronymic,
            email: d.email,
            phone: d.phone,
            role: 'dentist',
            specialization: d.specialization,
            licenseNumber: d.licenseNumber,
            isActive: true,
            schedule: {
                defaultAvailability: [
                    { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
                    { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
                    { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
                    { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
                    { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
                ],
            },
        });
        console.log('Created dentist:', d.email);
    }

    // Create receptionist
    const recPass = await bcrypt.hash('reception123', 10);
    const recAuth = await Auth.create({
        email: 'reception@ararat-dental.am',
        password: recPass,
        clinicId: clinic._id,
        role: 'receptionist',
        firstName: '\u053C\u0578\u0582\u057D\u056B\u0576\u0565',
        lastName: '\u0531\u057E\u0565\u057F\u056B\u057D\u0575\u0561\u0576',
        isActive: true,
    });
    await User.create({
        clinicId: clinic._id,
        authId: recAuth._id,
        firstName: '\u053C\u0578\u0582\u057D\u056B\u0576\u0565',
        lastName: '\u0531\u057E\u0565\u057F\u056B\u057D\u0575\u0561\u0576',
        email: 'reception@ararat-dental.am',
        phone: '+37496123456',
        role: 'receptionist',
        isActive: true,
    });
    console.log('Created receptionist');

    // Create patients
    const patients = [
        {
            firstName: '\u0533\u0561\u0563\u056B\u056F',
            lastName: '\u054A\u0578\u0572\u0578\u057D\u0575\u0561\u0576',
            patronymic: '\u054D\u0565\u0580\u0563\u0565\u0575\u056B',
            dateOfBirth: new Date('1985-03-15'),
            gender: 'male',
            phone: '+37477111111',
            email: 'gagik@example.com',
        },
        {
            firstName: '\u0531\u0576\u0561\u0570\u056B\u057F',
            lastName: '\u0544\u056B\u0576\u0561\u057D\u0575\u0561\u0576',
            patronymic: '\u0531\u0580\u0574\u0565\u0576\u056B',
            dateOfBirth: new Date('1990-07-22'),
            gender: 'female',
            phone: '+37477222222',
            email: 'anahit@example.com',
        },
        {
            firstName: '\u0540\u0561\u0575\u056F',
            lastName: '\u0531\u057E\u0561\u0563\u0575\u0561\u0576',
            patronymic: '\u054E\u0561\u0570\u0561\u0576\u056B',
            dateOfBirth: new Date('1978-11-08'),
            gender: 'male',
            phone: '+37477333333',
            email: 'hayk@example.com',
        },
        {
            firstName: '\u0546\u0561\u0580\u0565',
            lastName: '\u0540\u0561\u056F\u0578\u0562\u0575\u0561\u0576',
            dateOfBirth: new Date('2000-01-30'),
            gender: 'female',
            phone: '+37477444444',
            email: 'nare@example.com',
        },
        {
            firstName: '\u054E\u0561\u0570\u0561\u0576',
            lastName: '\u0533\u0561\u057D\u057A\u0561\u0580\u0575\u0561\u0576',
            patronymic: '\u054A\u0565\u057F\u0580\u0578\u057D\u056B',
            dateOfBirth: new Date('1965-05-12'),
            gender: 'male',
            phone: '+37477555555',
        },
        {
            firstName: '\u0531\u0576\u056B',
            lastName: '\u054D\u056B\u0574\u0578\u0576\u0575\u0561\u0576',
            dateOfBirth: new Date('1995-09-03'),
            gender: 'female',
            phone: '+37477666666',
        },
        {
            firstName: '\u0531\u0580\u0574\u0565\u0576',
            lastName: '\u053F\u0561\u0580\u0561\u057A\u0565\u057F\u0575\u0561\u0576',
            patronymic: '\u0540\u0561\u0575\u056F\u056B',
            dateOfBirth: new Date('1988-12-25'),
            gender: 'male',
            phone: '+37477777777',
        },
        {
            firstName: '\u0544\u0561\u0580\u056B\u0561\u0574',
            lastName: '\u054A\u0565\u057F\u0580\u0578\u057D\u0575\u0561\u0576',
            dateOfBirth: new Date('2010-04-18'),
            gender: 'female',
            phone: '+37477888888',
        },
    ];

    for (const p of patients) {
        await Patient.create({
            clinicId: clinic._id,
            ...p,
            address: { city: '\u0535\u0580\u0587\u0561\u0576', country: '\u0540\u0561\u0575\u0561\u057D\u057F\u0561\u0576' },
            medicalHistory: { conditions: [], allergies: [], medications: [], notes: '' },
            status: 'active',
            isActive: true,
        });
    }
    console.log(`Created ${patients.length} patients`);

    // Create treatments
    const treatments = [
        { name: 'Dental Examination', nameHy: '\u0531\u057F\u0561\u0574\u0576\u0561\u0562\u0578\u0582\u056A\u0561\u056F\u0561\u0576 \u0566\u0576\u0576\u0578\u0582\u0574', nameRu: '\u0421\u0442\u043E\u043C\u0430\u0442\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043E\u0441\u043C\u043E\u0442\u0440', category: 'diagnostic', code: 'D0120', duration: 30, price: 5000 },
        { name: 'Dental X-Ray', nameHy: '\u0531\u057F\u0561\u0574\u056B \u057C\u0565\u0576\u057F\u0563\u0565\u0576', nameRu: '\u0420\u0435\u043D\u0442\u0433\u0435\u043D \u0437\u0443\u0431\u0430', category: 'diagnostic', code: 'D0220', duration: 15, price: 3000 },
        { name: 'Teeth Cleaning', nameHy: '\u0531\u057F\u0561\u0574\u0576\u0565\u0580\u056B \u0574\u0561\u0584\u0580\u0578\u0582\u0574', nameRu: '\u0427\u0438\u0441\u0442\u043A\u0430 \u0437\u0443\u0431\u043E\u0432', category: 'preventive', code: 'D1110', duration: 45, price: 15000 },
        { name: 'Tooth Filling', nameHy: '\u0531\u057F\u0561\u0574\u056B \u056C\u0565\u0581\u0578\u0582\u0574', nameRu: '\u041F\u043B\u043E\u043C\u0431\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435', category: 'general', code: 'D2140', duration: 45, price: 20000 },
        { name: 'Root Canal', nameHy: '\u0531\u0580\u0574\u0561\u057F\u0561\u056F\u0561\u0576 \u0562\u0578\u0582\u056A\u0578\u0582\u0574', nameRu: '\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u043A\u0430\u043D\u0430\u043B\u043E\u0432', category: 'endodontic', code: 'D3310', duration: 90, price: 45000 },
        { name: 'Tooth Extraction', nameHy: '\u0531\u057F\u0561\u0574\u056B \u0570\u0565\u057C\u0561\u0581\u0578\u0582\u0574', nameRu: '\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0437\u0443\u0431\u0430', category: 'surgical', code: 'D7140', duration: 30, price: 15000 },
        { name: 'Dental Crown', nameHy: '\u0531\u057F\u0561\u0574\u056B \u057A\u057D\u0561\u056F', nameRu: '\u0417\u0443\u0431\u043D\u0430\u044F \u043A\u043E\u0440\u043E\u043D\u043A\u0430', category: 'prosthodontic', code: 'D2740', duration: 60, price: 80000 },
        { name: 'Dental Bridge', nameHy: '\u0531\u057F\u0561\u0574\u0576\u0561\u056F\u0561\u0574\u0578\u0582\u0580\u057B', nameRu: '\u0417\u0443\u0431\u043D\u043E\u0439 \u043C\u043E\u0441\u0442', category: 'prosthodontic', code: 'D6210', duration: 90, price: 150000 },
        { name: 'Dental Implant', nameHy: '\u0531\u057F\u0561\u0574\u056B \u056B\u0574\u057A\u056C\u0561\u0576\u057F', nameRu: '\u0417\u0443\u0431\u043D\u043E\u0439 \u0438\u043C\u043F\u043B\u0430\u043D\u0442', category: 'surgical', code: 'D6010', duration: 120, price: 250000 },
        { name: 'Teeth Whitening', nameHy: '\u0531\u057F\u0561\u0574\u0576\u0565\u0580\u056B \u057D\u057A\u056B\u057F\u0561\u056F\u0578\u0582\u0574', nameRu: '\u041E\u0442\u0431\u0435\u043B\u0438\u0432\u0430\u043D\u0438\u0435 \u0437\u0443\u0431\u043E\u0432', category: 'cosmetic', code: 'D9972', duration: 60, price: 35000 },
        { name: 'Veneer', nameHy: '\u054E\u056B\u0576\u056B\u0580', nameRu: '\u0412\u0438\u043D\u0438\u0440', category: 'cosmetic', code: 'D2962', duration: 60, price: 120000 },
        { name: 'Orthodontic Braces', nameHy: '\u0555\u0580\u0569\u0578\u0564\u0578\u0576\u057F\u056B\u056F \u0562\u0580\u0565\u056F\u0565\u057F\u0576\u0565\u0580', nameRu: '\u041E\u0440\u0442\u043E\u0434\u043E\u043D\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0431\u0440\u0435\u043A\u0435\u0442\u044B', category: 'orthodontic', code: 'D8010', duration: 60, price: 500000 },
        { name: 'Gum Treatment', nameHy: '\u053C\u0576\u0564\u0565\u0580\u056B \u0562\u0578\u0582\u056A\u0578\u0582\u0574', nameRu: '\u041B\u0435\u0447\u0435\u043D\u0438\u0435 \u0434\u0435\u0441\u0435\u043D', category: 'periodontic', code: 'D4341', duration: 45, price: 25000 },
        { name: 'Fluoride Treatment', nameHy: '\u0556\u057F\u0578\u0580\u056B\u0564\u0561\u0575\u056B\u0576 \u0562\u0578\u0582\u056A\u0578\u0582\u0574', nameRu: '\u0424\u0442\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435', category: 'preventive', code: 'D1208', duration: 20, price: 5000 },
        { name: 'Sealant', nameHy: '\u054D\u056B\u056C\u0561\u0576\u057F', nameRu: '\u0413\u0435\u0440\u043C\u0435\u0442\u0438\u0437\u0430\u0446\u0438\u044F', category: 'pediatric', code: 'D1351', duration: 20, price: 8000 },
    ];

    for (const t of treatments) {
        await Treatment.create({
            clinicId: clinic._id,
            ...t,
            price: { amount: t.price, currency: 'AMD' },
        });
    }
    console.log(`Created ${treatments.length} treatments`);

    console.log('\n--- Seed Complete ---');
    console.log('Admin login: admin@ararat-dental.am / admin123');
    console.log('Dentist login: ani.hayrapetyan@ararat-dental.am / dentist123');
    console.log('Reception login: reception@ararat-dental.am / reception123');

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
});
