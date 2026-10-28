import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { RootState } from '../../store';
import { appointmentsActions } from '../../store/appointments';
import { EmptyState, LoadingSpinner, StatusChip } from '../../components/ui';
import AppointmentFormDialog from '../../components/appointments/AppointmentFormDialog';
import { usePermission } from '../../hooks';
import { formatDate, formatTime } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { appointmentLabel, statusKey } from '../../utils/appointments';

const PAGE_SIZE = 20;

/**
 * A patient's appointments, newest first, paginated on the server. Has its
 * own slice of the store: it used to write into the main appointments list,
 * so the Appointments page briefly showed this patient's visits.
 */
const PatientAppointmentsTab: React.FC<{ patientId: string; bookable: boolean }> = ({ patientId, bookable }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const can = usePermission();
    const { byPatient } = useSelector((state: RootState) => state.appointments);
    const loading = useSelector((state: RootState) => state.http.loading.includes('GET_PATIENT_APPOINTMENTS'));
    const [page, setPage] = useState(0);
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        dispatch(appointmentsActions.getPatientAppointments({ patientId, page: page + 1, limit: PAGE_SIZE }));
    }, [dispatch, patientId, page]);

    const rows = byPatient.patientId === patientId ? byPatient.list : [];

    return (
        <Box>
            {can('manageAppointments') && bookable && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setBooking(true)}>
                        {t('appointments.bookAppointment')}
                    </Button>
                </Box>
            )}

            {loading && !rows.length ? (
                <LoadingSpinner />
            ) : !rows.length ? (
                <EmptyState title={t('appointments.noAppointments')} />
            ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('appointments.dateTime')}</TableCell>
                                <TableCell>{t('appointments.dentist')}</TableCell>
                                <TableCell>{t('appointments.visitFor')}</TableCell>
                                <TableCell>{t('common.status')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((appt) => (
                                <TableRow key={appt._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/appointments/${appt._id}`)}>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        {formatDate(appt.startTime)} {formatTime(appt.startTime)}
                                    </TableCell>
                                    <TableCell>{staffName(appt.dentistId)}</TableCell>
                                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{appointmentLabel(appt)}</TableCell>
                                    <TableCell>
                                        <StatusChip status={appt.status} label={t(statusKey(appt.status))} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {byPatient.total > PAGE_SIZE && (
                        <TablePagination
                            component="div"
                            count={byPatient.total}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={PAGE_SIZE}
                            rowsPerPageOptions={[PAGE_SIZE]}
                        />
                    )}
                </TableContainer>
            )}

            <AppointmentFormDialog open={booking} defaultPatientId={patientId} onClose={() => setBooking(false)} />
        </Box>
    );
};

export default PatientAppointmentsTab;
