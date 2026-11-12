import { legacy_createStore as createStore, combineReducers, applyMiddleware } from 'redux';
import createSagaMiddleware from 'redux-saga';
import { all } from 'redux-saga/effects';
import { authReducer, watchAuth } from './auth';
import { patientsReducer, watchPatients } from './patients';
import { appointmentsReducer, watchAppointments } from './appointments';
import { treatmentsReducer, watchTreatments } from './treatments';
import { dentalRecordsReducer, watchDentalRecords } from './dental-records';
import { billingReducer, watchBilling } from './billing';
import { staffReducer, watchStaff } from './staff';
import { scheduleReducer, watchSchedule } from './schedule';
import { notificationsReducer, watchNotifications } from './notifications';
import { reportsReducer, watchReports } from './reports';
import { settingsReducer, watchSettings } from './settings';
import { clinicReducer, watchClinic } from './clinic';
import { treatmentPlansReducer, watchTreatmentPlans } from './treatment-plans';
import { httpReducer } from './http';
import { watchHttpToasts } from './http/toasts';

const rootReducer = combineReducers({
    auth: authReducer,
    patients: patientsReducer,
    appointments: appointmentsReducer,
    treatments: treatmentsReducer,
    dentalRecords: dentalRecordsReducer,
    billing: billingReducer,
    staff: staffReducer,
    schedule: scheduleReducer,
    notifications: notificationsReducer,
    reports: reportsReducer,
    settings: settingsReducer,
    clinic: clinicReducer,
    treatmentPlans: treatmentPlansReducer,
    http: httpReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

function* rootSaga() {
    yield all([
        watchAuth(),
        watchPatients(),
        watchAppointments(),
        watchTreatments(),
        watchDentalRecords(),
        watchBilling(),
        watchStaff(),
        watchSchedule(),
        watchNotifications(),
        watchReports(),
        watchSettings(),
        watchClinic(),
        watchTreatmentPlans(),
        watchHttpToasts(),
    ]);
}

const sagaMiddleware = createSagaMiddleware();

export const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));

sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
