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
export interface Patient {
    _id: string;
    clinicId: string;
    firstName: string;
    lastName: string;
    patronymic?: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    phone: string;
    email?: string;
    address?: Address;
    emergencyContact?: { name: string; relationship: string; phone: string };
    medicalHistory?: MedicalHistory;
    insurance?: Insurance;
    notes?: string;
    isActive: boolean;
    lastVisit?: string;
    createdAt: string;
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
    treatmentRoomId?: string;
    title: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: AppointmentStatus;
    treatmentType?: string;
    treatmentIds?: string[];
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

export interface ToothRecord {
    toothNumber: number;
    status: ToothStatus;
    surfaces: string[];
    conditions: string[];
    notes?: string;
}

export interface DentalChart {
    _id: string;
    clinicId: string;
    patientId: string;
    teeth: ToothRecord[];
    chartType: 'adult' | 'pediatric';
    notes?: string;
}

export interface TreatmentEntry {
    _id: string;
    clinicId: string;
    patientId: string;
    toothNumber: number;
    treatmentId?: string;
    treatmentName: string;
    dentistId: string;
    appointmentId?: string;
    date: string;
    surfaces: string[];
    notes?: string;
    images: { url: string; description: string; uploadedAt: string }[];
    cost?: number;
    currency?: Currency;
}

// Billing types
export type InvoiceStatus = 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer';

export interface InvoiceItem {
    treatmentId?: string;
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
    appointmentId?: string;
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

export interface BlockedTime {
    _id: string;
    clinicId: string;
    dentistId: string;
    startTime: string;
    endTime: string;
    reason: string;
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
