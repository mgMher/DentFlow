// Auth types
export interface LoginRequest {
    email: string;
    password: string;
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
    email: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    role: UserRole;
    clinicId: string;
    avatar?: string;
}

export type UserRole = 'super_admin' | 'clinic_admin' | 'dentist' | 'receptionist' | 'assistant';

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
    title: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: AppointmentStatus;
    treatmentType?: string;
    treatmentIds?: (string | Treatment)[];
    notes?: string;
    cancelReason?: string;
    isRecurring: boolean;
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
    isCustom: boolean;
    isActive: boolean;
}

// Dental Record types
export type ToothStatus =
    | 'healthy' | 'filled' | 'crown' | 'missing' | 'implant'
    | 'needs_treatment' | 'root_canal' | 'decayed' | 'bridge' | 'veneer';

export type ToothSurface =
    | 'mesial' | 'distal' | 'occlusal' | 'incisal'
    | 'buccal' | 'lingual' | 'palatal' | 'cervical';

export interface ToothStatusChange {
    _id?: string;
    previousStatus?: ToothStatus;
    status: ToothStatus;
    surfaces: ToothSurface[];
    conditions: string[];
    notes?: string;
    changedBy?: string | UserProfile;
    changedAt: string;
}

export interface ToothRecord {
    toothNumber: number;
    status: ToothStatus;
    surfaces: ToothSurface[];
    conditions: string[];
    notes?: string;
    history?: ToothStatusChange[];
    updatedAt?: string;
}

export interface DentalChart {
    _id: string;
    clinicId: string;
    patientId: string;
    teeth: ToothRecord[];
    chartType: 'adult' | 'pediatric';
    notes?: string;
}

export interface ToothHistory {
    toothNumber: number;
    current: {
        status: ToothStatus;
        surfaces: ToothSurface[];
        conditions: string[];
        notes?: string;
        updatedAt?: string;
    };
    statusHistory: ToothStatusChange[];
    treatments: TreatmentEntry[];
}

export interface TreatmentEntry {
    _id: string;
    clinicId: string;
    patientId: string;
    toothNumber: number;
    // These three are populated by the API on read — plain ids on write.
    treatmentId?: string | Treatment;
    treatmentName: string;
    dentistId: string | UserProfile;
    appointmentId?: string | Appointment;
    date: string;
    surfaces: ToothSurface[];
    notes?: string;
    images: { url: string; description: string; uploadedAt: string }[];
    cost?: number;
    currency?: Currency;
}

// Billing types
export type InvoiceStatus = 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer';

export interface InvoiceItem {
    /** Populated by the API on read — a plain id on write. */
    treatmentId?: string | Treatment;
    description: string;
    quantity: number;
    unitPrice: number;
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
    currency: Currency;
    status: InvoiceStatus;
    dueDate?: string;
    notes?: string;
    createdAt: string;
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

// Notification types
export interface Notification {
    _id: string;
    clinicId: string;
    recipientId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    relatedId?: string;
    relatedType?: string;
    createdAt: string;
}

// Report types
export interface DashboardSummary {
    todayAppointments: number;
    monthRevenue: number;
    totalActivePatients: number;
    pendingInvoices: number;
    upcomingAppointments: Appointment[];
    recentActivity: ActivityItem[];
}

export interface ActivityItem {
    _id: string;
    type: 'appointment' | 'patient' | 'invoice' | 'treatment';
    description: string;
    timestamp: string;
    userId: string;
    userName: string;
}

// Pagination
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// API Response wrapper
export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    data: T;
}
