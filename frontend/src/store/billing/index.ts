import { call, put, select, takeLatest } from 'redux-saga/effects';
import { AxiosResponse } from 'axios';
import api from '../../api/axios';
import { httpActions } from '../http';
import { apiErrorCode, apiErrorMessage } from '../../utils/apiError';
import { Currency, Invoice, PatientBillingSummary, Payment, PaymentMethod, PaymentVoidType } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_INVOICES = 'GET_INVOICES';
const GET_INVOICES_SUCCESS = 'GET_INVOICES_SUCCESS';
const GET_INVOICE = 'GET_INVOICE';
const GET_INVOICE_SUCCESS = 'GET_INVOICE_SUCCESS';
const GET_PAYMENTS = 'GET_PAYMENTS';
const GET_PAYMENTS_SUCCESS = 'GET_PAYMENTS_SUCCESS';
const CREATE_INVOICE = 'CREATE_INVOICE';
const UPDATE_INVOICE = 'UPDATE_INVOICE';
const ISSUE_INVOICE = 'ISSUE_INVOICE';
const CANCEL_INVOICE = 'CANCEL_INVOICE';
const ADD_PAYMENT = 'ADD_PAYMENT';
const VOID_PAYMENT = 'VOID_PAYMENT';
const GET_PATIENT_INVOICES = 'GET_PATIENT_INVOICES';
const GET_PATIENT_INVOICES_SUCCESS = 'GET_PATIENT_INVOICES_SUCCESS';
const GET_PATIENT_BILLING_SUMMARY = 'GET_PATIENT_BILLING_SUMMARY';
const GET_PATIENT_BILLING_SUMMARY_SUCCESS = 'GET_PATIENT_BILLING_SUMMARY_SUCCESS';

export type InvoiceStatusFilter = Invoice['status'] | 'overdue';

export interface InvoicesQuery {
    page?: number;
    limit?: number;
    status?: InvoiceStatusFilter;
    search?: string;
    patientId?: string;
}

export interface InvoiceItemInput {
    treatmentId?: string;
    treatmentEntryId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
}

export interface InvoiceInput {
    patientId?: string;
    appointmentId?: string;
    items: InvoiceItemInput[];
    /** '' clears it on a draft. */
    dueDate?: string;
    notes?: string;
    currency?: Currency;
    issue?: boolean;
}

export interface PaymentInput {
    amount: number;
    method: PaymentMethod;
    date?: string;
    reference?: string;
    notes?: string;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const billingActions = {
    getInvoices: (payload: InvoicesQuery) => ({ type: GET_INVOICES, payload }),
    /** The invoice and its payments. */
    getInvoice: (payload: string) => ({ type: GET_INVOICE, payload }),
    createInvoice: (payload: InvoiceInput) => ({ type: CREATE_INVOICE, payload }),
    updateInvoice: (payload: { id: string; data: InvoiceInput }) => ({ type: UPDATE_INVOICE, payload }),
    issueInvoice: (payload: string) => ({ type: ISSUE_INVOICE, payload }),
    cancelInvoice: (payload: { id: string; reason: string }) => ({ type: CANCEL_INVOICE, payload }),
    addPayment: (payload: { invoiceId: string; data: PaymentInput }) => ({ type: ADD_PAYMENT, payload }),
    voidPayment: (payload: { invoiceId: string; paymentId: string; type: PaymentVoidType; reason: string }) => ({
        type: VOID_PAYMENT,
        payload,
    }),
    getPatientInvoices: (payload: { patientId: string; page?: number; limit?: number }) => ({
        type: GET_PATIENT_INVOICES,
        payload,
    }),
    getPatientSummary: (payload: string) => ({ type: GET_PATIENT_BILLING_SUMMARY, payload }),
    clearCreated: () => ({ type: CREATE_INVOICE + '_CLEAR' }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getInvoices: (params: InvoicesQuery) => api.get('/billing/invoices', { params }),
    getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
    getPayments: (id: string) => api.get(`/billing/invoices/${id}/payments`),
    createInvoice: (data: InvoiceInput) => api.post('/billing/invoices', data),
    updateInvoice: (id: string, data: InvoiceInput) => api.patch(`/billing/invoices/${id}`, data),
    issueInvoice: (id: string) => api.patch(`/billing/invoices/${id}/issue`),
    cancelInvoice: (id: string, reason: string) => api.patch(`/billing/invoices/${id}/cancel`, { reason }),
    addPayment: (id: string, data: PaymentInput) => api.post(`/billing/invoices/${id}/payments`, data),
    voidPayment: (id: string, paymentId: string, type: PaymentVoidType, reason: string) =>
        api.patch(`/billing/invoices/${id}/payments/${paymentId}/void`, { type, reason }),
    getPatientSummary: (patientId: string) => api.get(`/billing/patients/${patientId}/summary`),
};

const unwrap = (res: any) => res.data?.data ?? res.data;

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* read(action: any, fallbackKey: string, request: () => Promise<any>, success: (data: any) => any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: AxiosResponse = yield call(request);
        yield put(success(unwrap(res)));
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

/** After any change, the lists the user may go back to are refreshed with the query they used. */
function* refreshLists() {
    const state: BillingState = yield select((s: any) => s.billing);
    if (state.list.query) yield put({ type: GET_INVOICES, payload: state.list.query });
    if (state.byPatient.query) {
        yield put({ type: GET_PATIENT_INVOICES, payload: state.byPatient.query });
        yield put({ type: GET_PATIENT_BILLING_SUMMARY, payload: state.byPatient.query.patientId });
    }
}

/**
 * Every write returns the invoice as the server now has it; that replaces
 * the open one, so the detail page never shows stale amounts or status.
 */
function* write(action: any, fallbackKey: string, request: () => Promise<any>) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: AxiosResponse = yield call(request);
        const data = unwrap(res);
        const invoice: Invoice = data?.invoice ?? data;
        yield put({ type: GET_INVOICE_SUCCESS, payload: invoice });
        if (data?.payment || action.type === VOID_PAYMENT) {
            yield put({ type: GET_PAYMENTS, payload: invoice._id });
        }
        if (action.type === CREATE_INVOICE) yield put({ type: CREATE_INVOICE + '_DONE', payload: invoice._id });
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield call(refreshLists);
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, apiErrorMessage(err, fallbackKey), apiErrorCode(err)));
    }
}

function* getInvoicesSaga(action: any) {
    const query: InvoicesQuery = action.payload;
    yield call(read, action, 'errors.loadInvoices', () => service.getInvoices(query), (data) => ({
        type: GET_INVOICES_SUCCESS,
        payload: { list: data?.data ?? [], total: data?.pagination?.total ?? 0 },
    }));
}

function* getInvoiceSaga(action: any) {
    yield put({ type: GET_PAYMENTS, payload: action.payload });
    yield call(read, action, 'errors.loadInvoice', () => service.getInvoice(action.payload), (invoice) => ({
        type: GET_INVOICE_SUCCESS,
        payload: invoice,
    }));
}

function* getPaymentsSaga(action: any) {
    yield call(read, action, 'errors.loadPayments', () => service.getPayments(action.payload), (payments) => ({
        type: GET_PAYMENTS_SUCCESS,
        payload: { invoiceId: action.payload, list: payments ?? [] },
    }));
}

function* createInvoiceSaga(action: any) {
    yield call(write, action, 'errors.createInvoice', () => service.createInvoice(action.payload));
}

function* updateInvoiceSaga(action: any) {
    yield call(write, action, 'errors.updateInvoice', () => service.updateInvoice(action.payload.id, action.payload.data));
}

function* issueInvoiceSaga(action: any) {
    yield call(write, action, 'errors.issueInvoice', () => service.issueInvoice(action.payload));
}

function* cancelInvoiceSaga(action: any) {
    const { id, reason } = action.payload;
    yield call(write, action, 'errors.cancelInvoice', () => service.cancelInvoice(id, reason));
}

function* addPaymentSaga(action: any) {
    const { invoiceId, data } = action.payload;
    yield call(write, action, 'errors.addPayment', () => service.addPayment(invoiceId, data));
}

function* voidPaymentSaga(action: any) {
    const { invoiceId, paymentId, type, reason } = action.payload;
    yield call(write, action, 'errors.voidPayment', () => service.voidPayment(invoiceId, paymentId, type, reason));
}

function* getPatientInvoicesSaga(action: any) {
    const { patientId, page, limit } = action.payload;
    yield call(
        read,
        action,
        'errors.loadInvoices',
        () => service.getInvoices({ patientId, page, limit }),
        (data) => ({
            type: GET_PATIENT_INVOICES_SUCCESS,
            payload: { query: action.payload, list: data?.data ?? [], total: data?.pagination?.total ?? 0 },
        }),
    );
}

function* getPatientSummarySaga(action: any) {
    yield call(read, action, 'errors.loadInvoices', () => service.getPatientSummary(action.payload), (summary) => ({
        type: GET_PATIENT_BILLING_SUMMARY_SUCCESS,
        payload: { patientId: action.payload, summary },
    }));
}

export function* watchBilling() {
    yield takeLatest(GET_INVOICES, getInvoicesSaga);
    yield takeLatest(GET_INVOICE, getInvoiceSaga);
    yield takeLatest(GET_PAYMENTS, getPaymentsSaga);
    yield takeLatest(CREATE_INVOICE, createInvoiceSaga);
    yield takeLatest(UPDATE_INVOICE, updateInvoiceSaga);
    yield takeLatest(ISSUE_INVOICE, issueInvoiceSaga);
    yield takeLatest(CANCEL_INVOICE, cancelInvoiceSaga);
    yield takeLatest(ADD_PAYMENT, addPaymentSaga);
    yield takeLatest(VOID_PAYMENT, voidPaymentSaga);
    yield takeLatest(GET_PATIENT_INVOICES, getPatientInvoicesSaga);
    yield takeLatest(GET_PATIENT_BILLING_SUMMARY, getPatientSummarySaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface BillingState {
    /** The Billing page, with the query it was loaded with. */
    list: { query: InvoicesQuery | null; items: Invoice[]; total: number };
    /** The open invoice — screens must check its `_id`. */
    current: Invoice | null;
    payments: { invoiceId: string | null; list: Payment[] };
    /** One patient's invoices and balance (patient page). */
    byPatient: {
        query: { patientId: string; page?: number; limit?: number } | null;
        items: Invoice[];
        total: number;
        summary: (PatientBillingSummary & { patientId: string }) | null;
    };
    /** Id of the invoice just created, for the create page to navigate to. */
    createdId: string | null;
}

const initialState: BillingState = {
    list: { query: null, items: [], total: 0 },
    current: null,
    payments: { invoiceId: null, list: [] },
    byPatient: { query: null, items: [], total: 0, summary: null },
    createdId: null,
};

export const billingReducer = (state = initialState, action: any): BillingState => {
    switch (action.type) {
        case GET_INVOICES:
            return { ...state, list: { ...state.list, query: action.payload } };
        case GET_INVOICES_SUCCESS:
            return { ...state, list: { ...state.list, items: action.payload.list, total: action.payload.total } };
        case GET_INVOICE_SUCCESS:
            return { ...state, current: action.payload };
        case GET_PAYMENTS_SUCCESS:
            return { ...state, payments: action.payload };
        case GET_PATIENT_INVOICES:
            return {
                ...state,
                byPatient:
                    state.byPatient.query?.patientId === action.payload.patientId
                        ? { ...state.byPatient, query: action.payload }
                        : { query: action.payload, items: [], total: 0, summary: null },
            };
        case GET_PATIENT_INVOICES_SUCCESS:
            return {
                ...state,
                byPatient: { ...state.byPatient, items: action.payload.list, total: action.payload.total },
            };
        case GET_PATIENT_BILLING_SUMMARY_SUCCESS:
            return {
                ...state,
                byPatient: { ...state.byPatient, summary: { ...action.payload.summary, patientId: action.payload.patientId } },
            };
        case CREATE_INVOICE + '_DONE':
            return { ...state, createdId: action.payload };
        case CREATE_INVOICE + '_CLEAR':
            return { ...state, createdId: null };
        default:
            return state;
    }
};
