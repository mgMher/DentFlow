import { TFunction } from 'i18next';
import { Notification } from '../types';
import { formatCurrency, formatDateTime } from './formatters';

/**
 * Typed notifications are stored as data and worded here, in the reader's
 * language; free-text ones (system, custom, older) are shown as stored.
 */
export const notificationText = (n: Notification, t: TFunction, language: string): { title: string; message: string } => {
    const d = n.data;
    if (!d) return { title: n.title ?? '', message: n.message ?? '' };

    const when = (iso?: string) => (iso ? formatDateTime(iso, language) : '');
    const reason = d.reason
        ? t(`appointments.cancelReasons.${d.reason}`, { defaultValue: d.reason })
        : '';
    const params = {
        patient: d.patientName ?? '—',
        dentist: d.dentistName ?? '—',
        when: when(d.startTime),
        previous: when(d.previousStartTime),
        count: d.count ?? 1,
        reason,
        number: d.invoiceNumber ?? '',
        amount: d.amount !== undefined ? formatCurrency(d.amount, d.currency) : '',
    };

    const key = (() => {
        switch (n.type) {
            case 'appointment_created':
                return (d.count ?? 1) > 1 ? 'appointmentSeries' : 'appointmentCreated';
            case 'appointment_rescheduled':
                return d.dentistChanged ? 'appointmentReassigned' : 'appointmentRescheduled';
            case 'appointment_cancelled':
                return (d.count ?? 1) > 1 ? 'appointmentsCancelled' : 'appointmentCancelled';
            case 'appointment_confirmed':
                return 'appointmentConfirmed';
            case 'dentist_appointments_cancelled':
                return 'dentistAppointmentsCancelled';
            case 'payment_received':
                return 'paymentReceived';
            case 'payment_refunded':
                return 'paymentRefunded';
            default:
                return null;
        }
    })();
    if (!key) return { title: n.title ?? '', message: n.message ?? '' };

    return {
        title: t(`notifications.types.${key}.title`, params),
        message: t(`notifications.types.${key}.message`, params),
    };
};

/** Where clicking a notification goes. */
export const notificationLink = (n: Notification): string | null => {
    if (!n.relatedId) return n.type === 'dentist_appointments_cancelled' ? '/appointments' : null;
    switch (n.relatedType) {
        case 'appointment':
            return `/appointments/${n.relatedId}`;
        case 'invoice':
            return `/billing/${n.relatedId}`;
        case 'patient':
            return `/patients/${n.relatedId}`;
        case 'staff':
            return `/staff/${n.relatedId}`;
        default:
            return null;
    }
};
