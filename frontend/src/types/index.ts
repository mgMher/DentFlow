// Auth types
export interface LoginRequest {
    email: string;
    password: string;
    /** F9: a browser trusted for 30 days skips the two-factor code. */
    trustedDevice?: string;
}

export interface RegisterRequest {
    clinicName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: UserProfile;
}

export interface UserProfile {
    _id: string;
    /** From /auth/me (F9). */
    twoFactorEnabled?: boolean;
    twoFactorRequired?: boolean;
    email: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    role: UserRole;
    clinicId: string;
    avatar?: string;
}

export type UserRole = 'super_admin' | 'clinic_admin' | 'dentist' | 'receptionist' | 'assistant';

// Staff types

/** Roles a clinic can staff. `super_admin` is platform-level, never assignable here. */
export type StaffRole = Exclude<UserRole, 'super_admin'>;

export const STAFF_ROLES: StaffRole[] = [
    'clinic_admin',
    'dentist',
    'receptionist',
    'assistant',
];

export const DENTIST_SPECIALIZATIONS = [
    'general_dentistry',
    'orthodontics',
    'periodontics',
    'endodontics',
    'prosthodontics',
    'pediatric_dentistry',
    'oral_surgery',
    'cosmetic_dentistry',
] as const;

export type DentistSpecialization = (typeof DENTIST_SPECIALIZATIONS)[number];

/**
 * One working window in a member's week. A day the member does not work is
 * absent from the array rather than present with a flag — that is what the
 * scheduler reads when it offers bookable slots.
 */
export interface DayAvailability {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

/**
 * The clinic-facing staff record (`user_profiles`). Its `_id` is *not* the id
 * appointments and invoices reference — that is `authId`. See `utils/staff.ts`.
 */
export interface StaffMember {
    _id: string;
    authId?: string;
    clinicId: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    email: string;
    phone?: string;
    role: UserRole;
    specialization?: string;
    licenseNumber?: string;
    avatar?: string;
    isActive: boolean;
    schedule?: { defaultAvailability?: DayAvailability[] };
    createdAt?: string;
    updatedAt?: string;
}

/** One row of `/reports/dentist-performance`, keyed by the dentist's auth id. */
export interface DentistAppointmentStats {
    _id: string;
    dentistProfileId?: string;
    dentistName?: string;
    totalAppointments: number;
    completed: number;
    cancelled: number;
}

export interface DentistRevenueStats {
    _id: string;
    dentistProfileId?: string;
    dentistName?: string;
    totalRevenue: number;
    invoiceCount: number;
}

export interface DentistPerformance {
    appointmentsPerDentist: DentistAppointmentStats[];
    revenuePerDentist: DentistRevenueStats[];
}

// Clinic types
export interface Clinic {
    _id: string;
    name: string;
    address: Address;
    phone: string;
    email: string;
    logo?: string;
    workingHours: WorkingHour[];
    timezone: string;
    language: 'hy' | 'ru' | 'en';
    currency: Currency;
    subscription: { plan: string; status: string; expiresAt: string };
    isActive: boolean;
}

export interface Address {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
}

export interface WorkingHour {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isOpen: boolean;
}

export type Currency = 'AMD' | 'USD' | 'RUB';

// Patient types
export type PatientStatus = 'active' | 'inactive' | 'archived' | 'deceased';

export const PATIENT_STATUSES: PatientStatus[] = ['active', 'inactive', 'archived', 'deceased'];

export interface PatientStatusChange {
    _id?: string;
    /** Absent on the first entry, which records the registration. */
    from?: PatientStatus;
    to: PatientStatus;
    reason?: string;
    /** Populated by the API on read. */
    changedBy?: string | UserProfile;
    changedAt: string;
}

export interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
}

export interface Patient {
    _id: string;
    clinicId: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    phone: string;
    email?: string | null;
    photo?: string | null;
    address?: Address;
    emergencyContact?: EmergencyContact;
    /** Parents and guardians (F8). */
    guardians?: Guardian[];
    medicalHistory?: MedicalHistory;
    insurance?: Insurance;
    notes?: string;
    status: PatientStatus;
    isActive: boolean;
    /** Only returned when fetching a single patient, not in list responses. */
    statusHistory?: PatientStatusChange[];
    lastVisit?: string;
    createdAt: string;
}

export interface PatientStats {
    totalPatients: number;
    activePatients: number;
    inactivePatients: number;
    newPatientsThisMonth: number;
    byStatus: Record<PatientStatus, number>;
}

export interface MedicalHistory {
    conditions: string[];
    allergies: string[];
    medications: string[];
    notes?: string;
}

export interface Insurance {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    expirationDate?: string;
}

// Appointment types
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
    _id: string;
    clinicId: string;
    patientId: string | Patient;
    dentistId: string | UserProfile;
    // Populated by the API on findById/findAll — string only before it is sent.
    treatmentRoomId?: string | TreatmentRoom;
    title?: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: AppointmentStatus;
    treatmentType?: string;
    treatmentIds?: (string | Treatment)[];
    notes?: string;
    /** A code (see CANCEL_REASONS) or, on older records, free text. */
    cancelReason?: string;
    cancelNote?: string;
    cancelledAt?: string;
    cancelledBy?: string | UserProfile;
    isRecurring: boolean;
    seriesId?: string;
    color?: string;
    createdAt: string;
}

// Treatment types
export type TreatmentCategory =
    | 'general' | 'surgical' | 'cosmetic' | 'orthodontic'
    | 'endodontic' | 'periodontic' | 'prosthodontic'
    | 'pediatric' | 'diagnostic' | 'preventive';

export interface Treatment {
    _id: string;
    clinicId: string;
    name: string;
    nameHy?: string;
    nameRu?: string;
    category: TreatmentCategory;
    description?: string;
    code?: string;
    duration: number;
    price: { amount: number; currency: Currency };
    /** What a tooth becomes once this is done; prefills chart entries. */
    toothStatus?: ToothStatus;
    isCustom: boolean;
    isActive: boolean;
}

// Dental Record types — tooth numbers are FDI (11–48, primary 51–85)
export type ToothStatus =
    | 'healthy' | 'filled' | 'crown' | 'missing' | 'implant'
    | 'needs_treatment' | 'root_canal' | 'decayed' | 'bridge' | 'veneer';

export type ToothSurface =
    | 'mesial' | 'distal' | 'occlusal' | 'incisal'
    | 'buccal' | 'lingual' | 'palatal' | 'cervical';

export type SurfaceStatus = 'decayed' | 'filled' | 'sealant';

export interface SurfaceState {
    surface: ToothSurface;
    status: SurfaceStatus;
}

/** `mixed` (F12): both sets, each position showing the primary tooth or its permanent successor. */
export type ChartType = 'adult' | 'pediatric' | 'mixed';

type PersonRef = string | { _id?: string; firstName?: string; lastName?: string };

export interface ToothStatusChange {
    _id?: string;
    previousStatus?: ToothStatus;
    status: ToothStatus;
    surfaces: SurfaceState[];
    conditions: string[];
    notes?: string;
    changedBy?: PersonRef;
    changedAt: string;
    treatmentEntryId?: string;
}

export interface ToothRecord {
    toothNumber: number;
    status: ToothStatus;
    surfaces: SurfaceState[];
    conditions: string[];
    notes?: string;
    history?: ToothStatusChange[];
    updatedAt?: string;
    updatedBy?: string;
}

export interface DentalChart {
    _id: string;
    clinicId: string;
    patientId: string;
    teeth: ToothRecord[];
    chartType: ChartType;
    /** Chart types switched away from; switching back restores them. */
    archivedChartTypes: ChartType[];
    /** Mixed chart: primary teeth replaced by their permanent successor (kept on the server). */
    replacedTeeth?: { toothNumber: number; replacedAt: string }[];
    notes?: string;
}

export interface ToothHistory {
    toothNumber: number;
    /** Null when the tooth is not on the current chart (e.g. a permanent tooth on a primary chart). */
    current: {
        status: ToothStatus;
        surfaces: SurfaceState[];
        conditions: string[];
        notes?: string;
        updatedAt?: string;
    } | null;
    statusHistory: ToothStatusChange[];
    treatments: TreatmentEntry[];
}

export type TreatmentEntryStatus = 'planned' | 'done';

export interface TreatmentEntry {
    _id: string;
    clinicId: string;
    patientId: string;
    /** Empty for whole-mouth work (exam, X-ray, cleaning). */
    teeth: number[];
    status: TreatmentEntryStatus;
    // These are populated by the API on read — plain ids on write.
    treatmentId?: string | Treatment;
    treatmentName: string;
    dentistId: PersonRef;
    appointmentId?: string | Appointment;
    date: string;
    surfaces: ToothSurface[];
    resultStatus?: ToothStatus;
    notes?: string;
    images: { url: string; description: string; uploadedAt: string }[];
    cost?: number;
    currency?: Currency;
    createdBy?: PersonRef;
    completedAt?: string;
    completedBy?: PersonRef;
    voidedAt?: string;
    voidedBy?: PersonRef;
    voidReason?: string;
    /** The treatment plan this item belongs to (populated with title and status on read). */
    planId?: string | { _id: string; title: string; status: TreatmentPlanStatus };
    /** Plan stage (visit 1, 2…). */
    stage?: number;
    /** Percent off `cost` agreed in the plan; carried to the invoice line. */
    discount?: number;
    /** Set when the plan is accepted: false for items the patient declined. */
    planAccepted?: boolean;
}

// Treatment plans (F1) — amounts in major units
export type TreatmentPlanStatus = 'draft' | 'presented' | 'accepted' | 'completed' | 'declined' | 'cancelled';
export type TreatmentPlanAction = 'created' | 'presented' | 'accepted' | 'declined' | 'revised' | 'cancelled' | 'completed';

export interface TreatmentPlanSummary {
    items: number;
    done: number;
    declined: number;
    subtotal: number;
    discount: number;
    total: number;
    doneTotal: number;
    /** What the patient agreed to; null until accepted. */
    acceptedTotal: number | null;
}

export interface TreatmentPlanItem extends TreatmentEntry {
    /** Price after the item's discount. */
    net: number;
    invoiceId?: string | { _id: string; invoiceNumber: string; status: InvoiceStatus };
}

export interface TreatmentPlan {
    _id: string;
    patientId: string;
    title: string;
    dentistId: PersonRef;
    status: TreatmentPlanStatus;
    currency: Currency;
    notes?: string;
    /** Clinic day (YYYY-MM-DD) the estimate is valid until. */
    validUntil?: string;
    revision: number;
    createdBy?: PersonRef;
    presentedAt?: string;
    acceptedAt?: string;
    acceptedBy?: PersonRef;
    closedAt?: string;
    closeReason?: string;
    history?: { action: TreatmentPlanAction; at: string; by?: PersonRef; note?: string }[];
    createdAt: string;
    updatedAt: string;
    summary: TreatmentPlanSummary;
    /** Only on the single-plan read. */
    items?: TreatmentPlanItem[];
}

export interface TreatmentPlanItemInput {
    teeth: number[];
    treatmentId?: string;
    treatmentName: string;
    surfaces?: ToothSurface[];
    resultStatus?: ToothStatus;
    dentistId?: string;
    cost: number;
    discount?: number;
    stage?: number;
    notes?: string;
}

// Billing types — amounts arrive in major units (dram, dollars)
/** Stored statuses. "Overdue" is computed: see `Invoice.isOverdue`. */
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer';
export type PaymentVoidType = 'refund' | 'mistake';

export interface InvoiceItem {
    /** Populated by the API on read — a plain id on write. */
    treatmentId?: string | Treatment;
    /** The chart entry this line bills. */
    treatmentEntryId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    /** Percent, 0–100. */
    discount: number;
    total: number;
}

export interface Invoice {
    _id: string;
    clinicId: string;
    patientId: string | Patient;
    /** Populated by the API on read — a plain id on write. */
    appointmentId?: string | Appointment;
    invoiceNumber: string;
    items: InvoiceItem[];
    subtotal: number;
    discountTotal: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    currency: Currency;
    status: InvoiceStatus;
    /** Issued or partly paid and past the due date. */
    isOverdue: boolean;
    dueDate?: string;
    notes?: string;
    createdAt: string;
    createdBy?: PersonRef;
    issuedAt?: string;
    issuedBy?: PersonRef;
    cancelledAt?: string;
    cancelledBy?: PersonRef;
    cancelReason?: string;
}

export interface Payment {
    _id: string;
    clinicId: string;
    invoiceId: string;
    patientId: string;
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    date: string;
    reference?: string;
    notes?: string;
    receivedBy?: PersonRef;
    voidedAt?: string;
    voidedBy?: PersonRef;
    voidType?: PaymentVoidType;
    voidReason?: string;
    /** F10: the number of the receipt the clinic's cash register printed. */
    fiscalNumber?: string;
    fiscalRecordedAt?: string;
}

/** F10: money received as one fiscal receipt (a multi-invoice payment's parts together). */
export interface FiscalReceipt {
    receiptKey: string;
    paymentIds: string[];
    date: string;
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    patient: { _id: string; firstName: string; lastName: string; patronymic?: string } | null;
    invoices: { _id: string; invoiceNumber: string }[];
    onAccount: boolean;
    fiscalNumber: string | null;
    fiscalRecordedAt: string | null;
    refunded: boolean;
}

export interface PatientBillingSummary {
    byCurrency: { currency: Currency; billed: number; paid: number; balance: number; invoices: number; overdue: number }[];
    unbilledTreatments: number;
}

// Schedule types
export interface TreatmentRoom {
    _id: string;
    clinicId: string;
    name: string;
    description?: string;
    equipment: string[];
    isActive: boolean;
}

export type BlockedTimeReason =
    | 'break' | 'lunch' | 'vacation' | 'personal' | 'meeting' | 'other';

export const BLOCKED_TIME_REASONS: BlockedTimeReason[] = [
    'break', 'lunch', 'vacation', 'personal', 'meeting', 'other',
];

export interface BlockedTime {
    _id: string;
    clinicId: string;
    // Populated by the API on read — an auth User id on write.
    dentistId: string | UserProfile;
    startTime: string;
    endTime: string;
    reason: BlockedTimeReason;
    title?: string;
    isRecurring: boolean;
}

// Patient account (F4) — amounts in major units
export interface PatientAccount {
    currency: Currency;
    outstanding: number;
    credit: number;
    /** Positive: the patient owes; negative: the clinic holds their money. */
    balance: number;
    openInvoices: {
        _id: string;
        invoiceNumber: string;
        issuedAt?: string;
        dueDate?: string;
        status: InvoiceStatus;
        total: number;
        paid: number;
        balance: number;
    }[];
    credits: { _id: string; amount: number; date: string; method: PaymentMethod; reference?: string; receivedBy?: PersonRef }[];
}

export interface StatementLine {
    date: string;
    type: 'invoice' | 'invoice_cancelled' | 'payment' | 'payment_voided';
    invoiceId?: string;
    invoiceNumber?: string;
    paymentId?: string;
    method?: PaymentMethod;
    onAccount?: boolean;
    fromCredit?: boolean;
    reason?: string;
    charge: number;
    payment: number;
    balance: number;
}

// Account security (F9)
export interface TwoFactorSetup {
    secret: string;
    otpauthUrl: string;
    /** PNG data URL of the QR code. */
    qr: string;
}

export interface TwoFactorStatus {
    enabled: boolean;
    enabledAt: string | null;
    required: boolean;
    backupCodesLeft: number;
    trustedDevices: number;
}

export interface SignedInDevice {
    _id: string;
    userAgent?: string;
    ip?: string;
    lastUsedAt: string;
    createdAt: string;
    current: boolean;
}

// Family links (F8)
export type GuardianRelationship = 'mother' | 'father' | 'grandparent' | 'sibling' | 'guardian' | 'other';

/** A guardian is another patient (`patientId`) or a contact (`name` + `phone`). */
export interface Guardian {
    _id: string;
    patientId?: string;
    name?: string;
    phone?: string;
    relationship: GuardianRelationship;
    isPrimary: boolean;
}

export interface FamilyPerson {
    _id: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    phone: string;
    dateOfBirth: string;
    status: PatientStatus;
    age: number | null;
    telegram: boolean;
}

export interface PatientFamily {
    age: number | null;
    minor: boolean;
    guardians: (Omit<Guardian, 'patientId'> & { patient?: FamilyPerson | null })[];
    children: (FamilyPerson & { relationship: GuardianRelationship; isPrimary: boolean })[];
    siblings: FamilyPerson[];
}

export interface FamilyAccount {
    currency: Currency;
    members: { patient: { _id: string; firstName: string; lastName: string; patronymic?: string }; self: boolean; outstanding: number; credit: number; balance: number }[];
    outstanding: number;
    credit: number;
    balance: number;
    openInvoices: (PatientAccount['openInvoices'][number] & { patientId: string })[];
}

// Dentist commission (F11) — amounts in major units
export interface CommissionStatement {
    month: string;
    currency: Currency;
    status: 'approved' | 'live';
    approvedAt: string | null;
    approvedBy: string | null;
    ownOnly: boolean;
    canApprove: boolean;
    canReopen: boolean;
    /** The month is over (only ended months can be approved). */
    ended: boolean;
    rows: {
        dentistId: string;
        name: string;
        collected: number;
        rate: number;
        commission: number;
        adjustment: number;
        total: number;
        /** Approved months: change since approval, settled in the next approved month. */
        changedSince?: number;
    }[];
    totals: { collected: number; commission: number; adjustment: number; total: number };
    /** Collected but not tied to any dentist (admins). */
    unassigned?: number;
    lines: {
        dentistId: string;
        invoiceId: string | null;
        invoiceNumber: string | null;
        patient: string | null;
        description: string;
        collected: number;
        commission: number;
    }[];
}

export interface CommissionRates {
    defaultRate: number;
    dentists: { dentistId: string; firstName: string; lastName: string; isActive: boolean; rate: number | null }[];
}

// Audit log (F7)
export interface AuditChange {
    field: string;
    from?: unknown;
    to?: unknown;
    /** A secret or picture: only the fact that it changed. */
    masked?: boolean;
}

export interface AuditEntry {
    _id: string;
    at: string;
    event: string;
    area: string;
    method?: string;
    targetId?: string;
    patientId?: { _id: string; firstName: string; lastName: string; patronymic?: string } | null;
    actor: { kind: 'staff' | 'patient' | 'system'; userId?: string; name?: string; role?: UserRole };
    changes?: AuditChange[];
    details?: Record<string, string | number | boolean>;
    ip?: string;
    userAgent?: string;
}

export interface AuditPage {
    items: AuditEntry[];
    next: string | null;
}

// Patient documents and X-rays (F6)
export type DocumentKind = 'xray' | 'photo' | 'consent' | 'referral' | 'lab' | 'other';

export interface PatientDocument {
    _id: string;
    patientId: string;
    kind: DocumentKind;
    title: string;
    teeth: number[];
    takenAt: string;
    notes?: string;
    file: { originalName: string; mimeType: string; size: number; sha256: string; viewable: boolean };
    uploadedBy?: PersonRef;
    createdAt: string;
}

// Day report and debtors (F5) — amounts in major units
export interface CashReportLine {
    _id: string;
    at: string;
    patient?: PersonRef & { patronymic?: string };
    invoiceId: string | null;
    invoiceNumber: string | null;
    method: PaymentMethod;
    amount: number;
    by: string;
    /** A payment that was later given back. */
    refunded: boolean;
    fiscalNumber: string | null;
}

export interface CashReport {
    date: string;
    currency: Currency;
    totals: { received: number; refunded: number; net: number; count: number; onAccount: number; fiscalMissing: number };
    expectedCash: number;
    byMethod: { method: PaymentMethod; received: number; refunded: number; net: number; count: number }[];
    byCashier: { name: string; received: number; refunded: number; cash: number; count: number }[];
    payments: CashReportLine[];
    refunds: CashReportLine[];
    closure: null | {
        countedCash: number;
        expectedCash: number;
        difference: number;
        note?: string;
        closedBy?: PersonRef;
        closedAt: string;
        /** Something on this day changed after it was closed. */
        changed: boolean;
    };
}

export type DebtAgeBucket = '0_30' | '31_60' | '61_90' | '90_plus';

export interface Debtor {
    patient: { _id: string; firstName: string; lastName: string; patronymic?: string; phone?: string; status: PatientStatus };
    owed: number;
    credit: number;
    net: number;
    invoices: number;
    oldestDate: string;
    daysOld: number;
    overdue: boolean;
    lastPayment: string | null;
    byAge: Record<DebtAgeBucket, number>;
}

export interface DebtorsReport {
    currency: Currency;
    totals: { patients: number; owed: number; credit: number; net: number; byAge: Record<DebtAgeBucket, number> };
    debtors: Debtor[];
}

// Appointment reminders (F3)
export type SmsProviderName = 'off' | 'twilio' | 'log';
export type ReminderRule = 'day_before' | 'hours_before';
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type ReminderChannel = 'telegram' | 'sms' | 'log';

export interface ReminderSettings {
    enabled: boolean;
    dayBeforeEnabled: boolean;
    dayBeforeTime: string;
    hoursBeforeEnabled: boolean;
    hoursBefore: number;
    telegram: {
        connected: boolean;
        botUsername: string | null;
        /** How patients' messages and answers reach the server. */
        mode: 'none' | 'webhook' | 'polling' | 'not_receiving';
    };
    sms: { provider: SmsProviderName; twilioAccountSid: string; twilioFrom: string; hasAuthToken: boolean };
}

export interface ReminderLogEntry {
    _id: string;
    appointmentId: string | { _id: string; startTime: string; status: AppointmentStatus };
    patientId: string | { _id: string; firstName: string; lastName: string };
    rule: ReminderRule;
    status: ReminderStatus;
    channel?: ReminderChannel;
    to?: string;
    /** Sent to the child's main guardian (F8). */
    guardian?: { name: string; relationship: GuardianRelationship };
    text?: string;
    /** A code (optedOut, noChannel, patientMissing) or the provider's message. */
    reason?: string;
    answer?: 'confirmed' | 'cancelled';
    answeredAt?: string;
    createdAt: string;
}

export interface PatientReminderStatus {
    enabled: boolean;
    optOut: boolean;
    telegramAvailable: boolean;
    telegramLinked: boolean;
    telegramLinkedAt: string | null;
    smsAvailable: boolean;
    /** Under 18 with a guardian (F8): reminders go to them instead. */
    guardian: { name: string; relationship: GuardianRelationship; channel: 'telegram' | 'sms' | null } | null;
}

// Notification types
export type NotificationType =
    | 'appointment_created'
    | 'appointment_rescheduled'
    | 'appointment_reminder'
    | 'appointment_cancelled'
    | 'appointment_confirmed'
    | 'dentist_appointments_cancelled'
    | 'new_patient'
    | 'payment_received'
    | 'payment_refunded'
    | 'system'
    | 'custom';

export interface Notification {
    _id: string;
    clinicId: string;
    recipientId: string;
    type: NotificationType;
    /** Free text for system / custom and older notifications. */
    title?: string;
    message?: string;
    /** Values for the wording of typed notifications. */
    data?: {
        patientName?: string;
        dentistName?: string;
        startTime?: string;
        previousStartTime?: string;
        dentistChanged?: boolean;
        count?: number;
        reason?: string;
        voidType?: string;
        invoiceNumber?: string;
        amount?: number;
        currency?: Currency;
    };
    /** Who did it (populated). */
    actorId?: { _id: string; firstName: string; lastName: string } | null;
    isRead: boolean;
    relatedId?: string;
    relatedType?: 'appointment' | 'invoice' | 'patient' | 'staff' | string;
    createdAt: string;
}

// Report types
type PersonName = { firstName: string; lastName: string };

/** GET /reports/dashboard — parts the role may not see are absent. */
export interface DashboardSummary {
    timezone: string;
    /** Dentists see their own appointments. */
    ownAppointments: boolean;
    today: { appointments: number; completed: number; noShow: number };
    activePatients: number;
    newPatientsThisMonth: number;
    /** Billing viewers only. */
    invoices?: { currency: Currency; open: number; overdue: number; outstanding: number };
    /** Admins only: collected this month. */
    monthRevenue?: { currency: Currency; amount: number };
    upcomingAppointments: Appointment[];
    recentActivity: ActivityItem[];
}

export interface ActivityItem {
    type: 'patient' | 'appointment' | 'treatment' | 'invoice' | 'payment';
    /** What to open: patient, appointment or invoice id (patient id for a treatment). */
    id: string;
    at: string;
    patient?: (PersonName & { _id: string; patronymic?: string }) | null;
    by?: PersonName | null;
    startTime?: string;
    treatmentName?: string;
    invoiceNumber?: string;
    amount?: number;
    currency?: Currency;
    /** A payment kept on the patient's account (no invoice): `id` is the patient. */
    onAccount?: boolean;
}

export type ReportGroupBy = 'day' | 'week' | 'month';

export interface ReportRange {
    startDate: string;
    endDate: string;
    timezone: string;
}

/** GET /reports/revenue (admins). "Collected" = payments received, not voided. */
export interface RevenueReport extends ReportRange {
    groupBy: ReportGroupBy;
    currency: Currency;
    collected: number;
    /** Part of `collected` paid in advance and not yet applied to an invoice (F4). */
    onAccount?: number;
    paymentCount: number;
    invoiced: number;
    invoiceCount: number;
    outstanding: { balance: number; invoices: number; overdue: number; overdueInvoices: number };
    byPeriod: { period: string; total: number; count: number }[];
    byMethod: { method: PaymentMethod; total: number; count: number }[];
    /** Legacy payments in another currency, never added to the totals. */
    otherCurrencies: { currency: Currency; total: number; count: number }[];
}

export interface AppointmentReport extends ReportRange {
    ownOnly: boolean;
    total: number;
    byStatus: Record<AppointmentStatus, number>;
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
}

export interface DentistPerformanceReport extends ReportRange {
    ownOnly: boolean;
    /** With money (admins). */
    currency?: Currency;
    unassignedCollected?: number;
    rows: (PersonName & {
        dentistId: string;
        isActive: boolean;
        appointments: number;
        completed: number;
        cancelled: number;
        noShow: number;
        treatmentsDone: number;
        collected?: number;
    })[];
}

export interface TreatmentReport extends ReportRange {
    ownOnly: boolean;
    currency?: Currency;
    rows: {
        treatmentId?: string;
        name: string;
        nameHy?: string;
        nameRu?: string;
        code?: string;
        done: number;
        collected?: number;
    }[];
}

export interface PatientReport extends ReportRange {
    total: number;
    active: number;
    newInRange: number;
    newByGender: Record<string, number>;
}

// Pagination

// API Response wrapper
export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T;
}

// ── Periodontal exams (F12) ───────────────────────────────────────────────────

/** One probing site: depth and recession in mm, bleeding, pus, plaque. */
export interface PerioSite {
    pd: number | null;
    /** Gum margin below the CEJ (positive) or above it (negative). Attachment loss = pd + rec. */
    rec: number | null;
    bop: boolean;
    sup: boolean;
    plaque: boolean;
}

export interface PerioTooth {
    toothNumber: number;
    missing: boolean;
    implant: boolean;
    mobility: number | null;
    furcation: number | null;
    /** DB, B, MB, DL, L, ML. */
    sites: PerioSite[];
}

export interface PerioSummary {
    teeth: number;
    sitesProbed: number;
    meanPd: number | null;
    meanCal: number | null;
    bopPercent: number | null;
    plaquePercent: number | null;
    sites4plus: number;
    sites6plus: number;
    mobileTeeth: number;
    furcationTeeth: number;
}

type PerioPerson = { _id: string; firstName?: string; lastName?: string } | null;

export interface PerioExamListItem {
    _id: string;
    date: string;
    createdAt: string;
    dentistId: PerioPerson;
    notes?: string;
    summary: PerioSummary;
}

export interface PerioExam extends PerioExamListItem {
    patientId: string;
    recordedBy: PerioPerson;
    teeth: PerioTooth[];
    updatedAt: string;
    previous: { _id: string; date: string; teeth: PerioTooth[]; summary: PerioSummary } | null;
}
