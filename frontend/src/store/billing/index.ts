import { call, put, takeLatest } from 'redux-saga/effects';
import api from '../../api/axios';
import { httpActions } from '../http';
import { Invoice, Payment } from '../../types';

// ── Action Types ──────────────────────────────────────────────────────────────

const GET_INVOICES = 'GET_INVOICES';
const GET_INVOICES_SUCCESS = 'GET_INVOICES_SUCCESS';
const GET_INVOICE = 'GET_INVOICE';
const GET_INVOICE_SUCCESS = 'GET_INVOICE_SUCCESS';
const CREATE_INVOICE = 'CREATE_INVOICE';
const CANCEL_INVOICE = 'CANCEL_INVOICE';
const ADD_PAYMENT = 'ADD_PAYMENT';
const GET_PAYMENTS = 'GET_PAYMENTS';
const GET_PAYMENTS_SUCCESS = 'GET_PAYMENTS_SUCCESS';
const GET_REVENUE = 'GET_REVENUE';
const GET_REVENUE_SUCCESS = 'GET_REVENUE_SUCCESS';

// ── Actions ───────────────────────────────────────────────────────────────────

export const billingActions = {
    getInvoices: (payload?: any) => ({ type: GET_INVOICES, payload }),
    getInvoicesSuccess: (payload: { invoices: Invoice[]; total: number }) => ({
        type: GET_INVOICES_SUCCESS,
        payload,
    }),
    getInvoice: (payload: string) => ({ type: GET_INVOICE, payload }),
    getInvoiceSuccess: (payload: Invoice) => ({ type: GET_INVOICE_SUCCESS, payload }),
    createInvoice: (payload: Partial<Invoice>) => ({ type: CREATE_INVOICE, payload }),
    cancelInvoice: (payload: string) => ({ type: CANCEL_INVOICE, payload }),
    addPayment: (payload: { invoiceId: string; data: Partial<Payment> }) => ({
        type: ADD_PAYMENT,
        payload,
    }),
    getPayments: (payload: string) => ({ type: GET_PAYMENTS, payload }),
    getPaymentsSuccess: (payload: Payment[]) => ({ type: GET_PAYMENTS_SUCCESS, payload }),
    getRevenue: (payload?: any) => ({ type: GET_REVENUE, payload }),
    getRevenueSuccess: (payload: any) => ({ type: GET_REVENUE_SUCCESS, payload }),
};

// ── Service ───────────────────────────────────────────────────────────────────

const service = {
    getInvoices: (params?: any) => api.get('/billing/invoices', { params }),
    getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
    createInvoice: (data: Partial<Invoice>) => api.post('/billing/invoices', data),
    cancelInvoice: (id: string) => api.patch(`/billing/invoices/${id}/cancel`),
    addPayment: (invoiceId: string, data: Partial<Payment>) =>
        api.post(`/billing/invoices/${invoiceId}/payments`, data),
    getPayments: (invoiceId: string) => api.get(`/billing/invoices/${invoiceId}/payments`),
    getRevenue: (params?: any) => api.get('/billing/revenue', { params }),
    getPatientHistory: (patientId: string) => api.get(`/billing/patients/${patientId}/history`),
};

// ── Sagas ─────────────────────────────────────────────────────────────────────

function* getInvoicesSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getInvoices, action.payload);
        const data = res.data?.data || res.data;
        yield put({
            type: GET_INVOICES_SUCCESS,
            payload: {
                invoices: data.data || data,
                total: data.total || 0,
            },
        });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load invoices'));
    }
}

function* getInvoiceSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getInvoice, action.payload);
        yield put({ type: GET_INVOICE_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load invoice'));
    }
}

function* createInvoiceSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.createInvoice, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_INVOICES });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to create invoice'));
    }
}

function* cancelInvoiceSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.cancelInvoice, action.payload);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_INVOICES });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to cancel invoice'));
    }
}

function* addPaymentSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        yield call(service.addPayment, action.payload.invoiceId, action.payload.data);
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendSuccess(action.type));
        yield put({ type: GET_INVOICE, payload: action.payload.invoiceId });
        yield put({ type: GET_PAYMENTS, payload: action.payload.invoiceId });
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to add payment'));
    }
}

function* getPaymentsSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getPayments, action.payload);
        yield put({ type: GET_PAYMENTS_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load payments'));
    }
}

function* getRevenueSaga(action: any) {
    yield put(httpActions.removeError(action.type));
    yield put(httpActions.appendLoading(action.type));
    try {
        const res: any = yield call(service.getRevenue, action.payload);
        yield put({ type: GET_REVENUE_SUCCESS, payload: res.data?.data || res.data });
        yield put(httpActions.removeLoading(action.type));
    } catch (err: any) {
        yield put(httpActions.removeLoading(action.type));
        yield put(httpActions.appendError(action.type, err?.data?.message || 'Failed to load revenue'));
    }
}

export function* watchBilling() {
    yield takeLatest(GET_INVOICES, getInvoicesSaga);
    yield takeLatest(GET_INVOICE, getInvoiceSaga);
    yield takeLatest(CREATE_INVOICE, createInvoiceSaga);
    yield takeLatest(CANCEL_INVOICE, cancelInvoiceSaga);
    yield takeLatest(ADD_PAYMENT, addPaymentSaga);
    yield takeLatest(GET_PAYMENTS, getPaymentsSaga);
    yield takeLatest(GET_REVENUE, getRevenueSaga);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface BillingState {
    invoices: Invoice[];
    currentInvoice: Invoice | null;
    payments: Payment[];
    revenue: any;
    total: number;
}

const initialState: BillingState = {
    invoices: [],
    currentInvoice: null,
    payments: [],
    revenue: null,
    total: 0,
};

export const billingReducer = (state = initialState, action: any): BillingState => {
    switch (action.type) {
        case GET_INVOICES_SUCCESS:
            return { ...state, invoices: action.payload.invoices, total: action.payload.total };
        case GET_INVOICE_SUCCESS:
            return { ...state, currentInvoice: action.payload };
        case GET_PAYMENTS_SUCCESS:
            return { ...state, payments: action.payload };
        case GET_REVENUE_SUCCESS:
            return { ...state, revenue: action.payload };
        default:
            return state;
    }
};
