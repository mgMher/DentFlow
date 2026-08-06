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
import { httpReducer } from './http';

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
    ]);
}

const sagaMiddleware = createSagaMiddleware();

export const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));

sagaMiddleware.run(rootSaga);

export type AppDispatch = typeof store.dispatch;
