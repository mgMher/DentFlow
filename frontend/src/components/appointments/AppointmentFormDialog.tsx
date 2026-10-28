import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import { format } from 'date-fns';
import api from '../../api/axios';
import { RootState } from '../../store';
import { appointmentsActions } from '../../store/appointments';
import { staffActions } from '../../store/staff';
import { scheduleActions } from '../../store/schedule';
import { useHttpState } from '../../hooks';
import { PatientPicker } from '../ui';
import { Appointment, Treatment } from '../../types';
import { staffRefId } from '../../utils/staff';
import { localizedTreatmentName } from '../../utils/appointments';
import { formatTime } from '../../utils/formatters';
import { toLocalDateString } from '../../utils/dates';

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

interface FormValues {
    patientId: string;
    dentistId: string;
    treatmentRoomId: string;
    date: string;
    startTime: string;
    duration: number;
    treatmentIds: string[];
    notes: string;
    repeat: Repeat;
    repeatUntil: string;
}

interface AppointmentFormDialogProps {
    open: boolean;
    onClose: () => void;
    /** Reschedule this appointment instead of booking a new one. */
    appointment?: Appointment | null;
    /** Prefill for a new booking (e.g. the day clicked in the calendar, or the patient page). */
    defaultDate?: string;
    defaultPatientId?: string;
}

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const ref = (value: unknown) => (value && typeof value === 'object' ? (value as { _id: string })._id : (value as string) || '');

/**
 * Book or reschedule an appointment.
 *
 * Shows the dentist's free time for the chosen day (from the availability
 * API), takes treatments from the catalogue (so the appointment is linked to
 * them and the duration follows), and can repeat the booking. When the time
 * is outside the dentist's working hours the API refuses it; the dialog then
 * asks whether to book anyway.
 */
const AppointmentFormDialog: React.FC<AppointmentFormDialogProps> = ({
    open,
    onClose,
    appointment,
    defaultDate,
    defaultPatientId,
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const isReschedule = !!appointment;
    const actionType = isReschedule ? 'UPDATE_APPOINTMENT' : 'CREATE_APPOINTMENT';

    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const rooms = useSelector((state: RootState) => state.schedule.rooms);
    const lastRecurring = useSelector((state: RootState) => state.appointments.lastRecurring);
    const single = useHttpState(actionType);
    const recurring = useHttpState('CREATE_RECURRING');
    const saving = single.loading || recurring.loading;
    const error = single.error || recurring.error;
    const errorCode = single.errorCode || recurring.errorCode;

    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [freeSlots, setFreeSlots] = useState<{ start: string; end: string }[] | null>(null);
    const [durationTouched, setDurationTouched] = useState(false);

    const defaults = useMemo<FormValues>(() => {
        if (appointment) {
            const start = new Date(appointment.startTime);
            return {
                patientId: ref(appointment.patientId),
                dentistId: ref(appointment.dentistId),
                treatmentRoomId: ref(appointment.treatmentRoomId),
                date: toLocalDateString(start),
                startTime: format(start, 'HH:mm'),
                duration: Math.round((new Date(appointment.endTime).getTime() - start.getTime()) / 60000),
                treatmentIds: (appointment.treatmentIds || []).map(ref),
                notes: appointment.notes || '',
                repeat: 'none',
                repeatUntil: '',
            };
        }
        return {
            patientId: defaultPatientId || '',
            dentistId: '',
            treatmentRoomId: '',
            date: defaultDate || toLocalDateString(),
            startTime: '09:00',
            duration: 30,
            treatmentIds: [],
            notes: '',
            repeat: 'none',
            repeatUntil: '',
        };
    }, [appointment, defaultDate, defaultPatientId]);

    const {
        control,
        handleSubmit,
        reset,
        watch,
        setValue,
        getValues,
        formState: { errors },
    } = useForm<FormValues>({ defaultValues: defaults });

    useEffect(() => {
        if (!open) return;
        reset(defaults);
        setDurationTouched(isReschedule);
        single.clearError();
        recurring.clearError();
        dispatch(staffActions.getDentists());
        dispatch(scheduleActions.getRooms());
        api.get('/treatments', { params: { limit: 100 } })
            .then((res) => {
                const payload = res.data?.data ?? res.data;
                setTreatments((payload?.data ?? payload ?? []).filter((x: Treatment) => x.isActive !== false));
            })
            .catch(() => setTreatments([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defaults]);

    const dentistId = watch('dentistId');
    const date = watch('date');
    const repeat = watch('repeat');
    const selectedTreatments = watch('treatmentIds');

    // Free time for the chosen dentist and day.
    useEffect(() => {
        if (!open || !dentistId || !date) {
            setFreeSlots(null);
            return;
        }
        let cancelled = false;
        api.get(`/schedule/availability/${dentistId}`, { params: { date } })
            .then((res) => !cancelled && setFreeSlots(res.data?.data ?? []))
            .catch(() => !cancelled && setFreeSlots(null));
        return () => {
            cancelled = true;
        };
    }, [open, dentistId, date]);

    // The planned treatments set the length, until the user picks one by hand.
    useEffect(() => {
        if (durationTouched || !selectedTreatments.length) return;
        const total = treatments
            .filter((tr) => selectedTreatments.includes(tr._id))
            .reduce((sum, tr) => sum + (tr.duration || 0), 0);
        if (total > 0) setValue('duration', DURATIONS.find((d) => d >= total) ?? DURATIONS[DURATIONS.length - 1]);
    }, [selectedTreatments, treatments, durationTouched, setValue]);

    // Close once the save went through.
    useEffect(() => {
        if (!single.success && !recurring.success) return;
        if (recurring.success && lastRecurring?.skipped.length) {
            toast.warning(
                t('appointments.seriesSkipped', { count: lastRecurring.skipped.length, created: lastRecurring.created.length }),
            );
        }
        single.clearSuccess();
        recurring.clearSuccess();
        onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [single.success, recurring.success]);

    const activeRooms = rooms.filter((r) => r.isActive !== false || r._id === ref(appointment?.treatmentRoomId));

    const submit = (values: FormValues, allowOutsideHours = false) => {
        const start = new Date(`${values.date}T${values.startTime}:00`);
        const end = new Date(start.getTime() + values.duration * 60000);
        const base = {
            dentistId: values.dentistId,
            treatmentRoomId: values.treatmentRoomId || undefined,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            treatmentIds: values.treatmentIds,
            notes: values.notes.trim() || undefined,
            ...(allowOutsideHours ? { allowOutsideHours: true } : {}),
        };

        if (isReschedule && appointment) {
            dispatch(appointmentsActions.updateAppointment({ id: appointment._id, data: base }));
        } else if (values.repeat !== 'none') {
            dispatch(
                appointmentsActions.createRecurring({
                    ...base,
                    patientId: values.patientId,
                    recurringPattern: { frequency: values.repeat, interval: 1, endDate: values.repeatUntil },
                }),
            );
        } else {
            dispatch(appointmentsActions.createAppointment({ ...base, patientId: values.patientId }));
        }
    };

    const today = toLocalDateString();

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <Box component="form" onSubmit={handleSubmit((v) => submit(v))} noValidate>
                <DialogTitle>{isReschedule ? t('appointments.reschedule') : t('appointments.newAppointment')}</DialogTitle>
                <DialogContent>
                    {error && (
                        <Alert
                            severity={errorCode === 'appointmentOutsideHours' ? 'warning' : 'error'}
                            sx={{ mb: 2 }}
                            action={
                                errorCode === 'appointmentOutsideHours' ? (
                                    <Button color="inherit" size="small" onClick={() => submit(getValues(), true)}>
                                        {t('appointments.bookAnyway')}
                                    </Button>
                                ) : undefined
                            }
                        >
                            {error}
                        </Alert>
                    )}

                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        {!isReschedule && (
                            <Grid item xs={12}>
                                <Controller
                                    name="patientId"
                                    control={control}
                                    rules={{ required: t('validation.required') }}
                                    render={({ field }) => (
                                        <PatientPicker
                                            value={field.value || null}
                                            onChange={(id) => field.onChange(id || '')}
                                            required
                                            error={!!errors.patientId}
                                            helperText={errors.patientId?.message}
                                        />
                                    )}
                                />
                            </Grid>
                        )}

                        <Grid item xs={12} sm={6}>
                            <Controller
                                name="dentistId"
                                control={control}
                                rules={{ required: t('validation.required') }}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        fullWidth
                                        required
                                        label={t('appointments.dentist')}
                                        error={!!errors.dentistId}
                                        helperText={errors.dentistId?.message}
                                    >
                                        {dentists.map((d) => (
                                            <MenuItem key={d._id} value={staffRefId(d)}>
                                                {d.lastName} {d.firstName}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Controller
                                name="treatmentRoomId"
                                control={control}
                                render={({ field }) => (
                                    <TextField {...field} select fullWidth label={t('appointments.room')}>
                                        <MenuItem value="">{t('common.none')}</MenuItem>
                                        {activeRooms.map((r) => (
                                            <MenuItem key={r._id} value={r._id}>
                                                {r.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <Controller
                                name="treatmentIds"
                                control={control}
                                render={({ field }) => (
                                    <Autocomplete
                                        multiple
                                        options={treatments}
                                        value={treatments.filter((tr) => field.value.includes(tr._id))}
                                        onChange={(_, value) => field.onChange(value.map((tr) => tr._id))}
                                        getOptionLabel={(tr) => localizedTreatmentName(tr)}
                                        isOptionEqualToValue={(a, b) => a._id === b._id}
                                        renderOption={(props, tr) => (
                                            <li {...props} key={tr._id}>
                                                <Box>
                                                    <Typography variant="body2">{localizedTreatmentName(tr)}</Typography>
                                                    {!!tr.duration && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('appointments.minutes', { count: tr.duration })}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </li>
                                        )}
                                        renderInput={(params) => <TextField {...params} label={t('appointments.plannedTreatments')} />}
                                    />
                                )}
                            />
                        </Grid>

                        <Grid item xs={12} sm={5}>
                            <Controller
                                name="date"
                                control={control}
                                rules={{ required: t('validation.required') }}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        type="date"
                                        fullWidth
                                        required
                                        label={t('appointments.date')}
                                        InputLabelProps={{ shrink: true }}
                                        error={!!errors.date}
                                        helperText={errors.date?.message}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <Controller
                                name="startTime"
                                control={control}
                                rules={{ required: t('validation.required') }}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        type="time"
                                        fullWidth
                                        required
                                        label={t('appointments.startTime')}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ step: 300 }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={6} sm={4}>
                            <Controller
                                name="duration"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        select
                                        fullWidth
                                        label={t('appointments.duration')}
                                        onChange={(e) => {
                                            setDurationTouched(true);
                                            field.onChange(Number(e.target.value));
                                        }}
                                    >
                                        {(DURATIONS.includes(field.value) ? DURATIONS : [...DURATIONS, field.value].sort((a, b) => a - b)).map((d) => (
                                            <MenuItem key={d} value={d}>
                                                {t('appointments.minutes', { count: d })}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                        </Grid>

                        {freeSlots && (
                            <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    {freeSlots.length ? t('appointments.freeTime') : t('appointments.noFreeTime')}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {freeSlots.map((slot) => (
                                        <Chip
                                            key={slot.start}
                                            size="small"
                                            variant="outlined"
                                            label={`${formatTime(slot.start)} – ${formatTime(slot.end)}`}
                                            onClick={() => setValue('startTime', format(new Date(slot.start), 'HH:mm'))}
                                        />
                                    ))}
                                </Box>
                            </Grid>
                        )}

                        {!isReschedule && (
                            <>
                                <Grid item xs={12} sm={6}>
                                    <Controller
                                        name="repeat"
                                        control={control}
                                        render={({ field }) => (
                                            <TextField {...field} select fullWidth label={t('appointments.repeat')}>
                                                {(['none', 'daily', 'weekly', 'monthly'] as Repeat[]).map((r) => (
                                                    <MenuItem key={r} value={r}>
                                                        {t(`appointments.repeatOptions.${r}`)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        )}
                                    />
                                </Grid>
                                {repeat !== 'none' && (
                                    <Grid item xs={12} sm={6}>
                                        <Controller
                                            name="repeatUntil"
                                            control={control}
                                            rules={{
                                                validate: (value) =>
                                                    !!value && value >= getValues('date')
                                                        ? true
                                                        : t('appointments.repeatUntilAfterStart'),
                                            }}
                                            render={({ field }) => (
                                                <TextField
                                                    {...field}
                                                    type="date"
                                                    fullWidth
                                                    required
                                                    label={t('appointments.repeatUntil')}
                                                    InputLabelProps={{ shrink: true }}
                                                    inputProps={{ min: date || today }}
                                                    error={!!errors.repeatUntil}
                                                    helperText={errors.repeatUntil?.message || t('appointments.repeatLimit')}
                                                />
                                            )}
                                        />
                                    </Grid>
                                )}
                            </>
                        )}

                        <Grid item xs={12}>
                            <Controller
                                name="notes"
                                control={control}
                                render={({ field }) => (
                                    <TextField {...field} fullWidth multiline rows={2} label={t('appointments.notes')} />
                                )}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={onClose} color="inherit" disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={saving}>
                        {saving ? t('common.loading') : t('common.save')}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};

export default AppointmentFormDialog;
