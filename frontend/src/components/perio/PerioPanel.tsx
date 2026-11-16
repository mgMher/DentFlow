import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    GlobalStyles,
    IconButton,
    Menu,
    MenuItem,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    CheckCircleOutline as SavedIcon,
    ErrorOutline as ErrorIcon,
    MoreVert as MoreIcon,
    Print as PrintIcon,
} from '@mui/icons-material';
import api from '../../api/axios';
import { RootState } from '../../store';
import { staffActions } from '../../store/staff';
import { usePermission } from '../../hooks';
import { Patient, PerioExam, PerioExamListItem, PerioSummary, PerioTooth } from '../../types';
import { apiErrorMessage } from '../../utils/apiError';
import { toLocalDateString } from '../../utils/dates';
import { formatDate, getFullName } from '../../utils/formatters';
import { staffName } from '../../utils/references';
import { staffRefId } from '../../utils/staff';
import { SUMMARY_ROWS } from '../../utils/perio';
import { EmptyState, LoadingSpinner } from '../ui';
import PerioGrid from './PerioGrid';

const unwrap = (res: any) => res.data?.data ?? res.data;
const SAVE_DELAY = 700;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** The figures, with the previous exam's beside them and which way they moved. */
const SummaryTable: React.FC<{ summary: PerioSummary; previous?: PerioSummary | null; previousDate?: string }> = ({
    summary,
    previous,
    previousDate,
}) => {
    const { t, i18n } = useTranslation();
    const show = (v: number | null, unit?: string) => (v == null ? '—' : `${v}${unit === '%' ? '%' : unit ? ` ${t('perio.mm')}` : ''}`);
    return (
        <Box component="table" sx={{ borderCollapse: 'collapse', fontSize: 13, '& td, & th': { py: 0.5, pr: 2, textAlign: 'left' } }}>
            {previous && (
                <thead>
                    <tr>
                        <th />
                        <Box component="th" sx={{ color: 'text.secondary', fontWeight: 600 }}>{t('perio.thisExam')}</Box>
                        <Box component="th" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {previousDate ? formatDate(previousDate, 'dd.MM.yyyy', i18n.language) : t('perio.previous')}
                        </Box>
                    </tr>
                </thead>
            )}
            <tbody>
                {SUMMARY_ROWS.map((row) => {
                    const now = summary[row.key];
                    const before = previous?.[row.key];
                    const delta = now != null && before != null ? Math.round((now - before) * 10) / 10 : null;
                    const better = delta != null && delta !== 0 && (delta < 0) === row.lowerIsBetter;
                    return (
                        <tr key={row.key}>
                            <Box component="td" sx={{ color: 'text.secondary' }}>{t(row.label)}</Box>
                            <Box component="td" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {show(now, row.unit)}
                                {delta != null && delta !== 0 && (
                                    <Box component="span" sx={{ ml: 1, fontSize: 12, color: better ? 'success.main' : 'error.main' }}>
                                        {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                                    </Box>
                                )}
                            </Box>
                            {previous && <Box component="td" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{show(before ?? null, row.unit)}</Box>}
                        </tr>
                    );
                })}
            </tbody>
        </Box>
    );
};

/** Date, dentist and notes of an exam. */
const ExamDetailsDialog: React.FC<{
    exam: PerioExam | null;
    open: boolean;
    onClose: () => void;
    onSaved: (exam: PerioExam) => void;
}> = ({ exam, open, onClose, onSaved }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const dentists = useSelector((state: RootState) => state.staff.dentists);
    const [date, setDate] = useState('');
    const [dentistId, setDentistId] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open || !exam) return;
        if (!dentists.length) dispatch(staffActions.getDentists());
        setDate(exam.date);
        setDentistId(exam.dentistId?._id ?? '');
        setNotes(exam.notes ?? '');
        setError(null);
    }, [open, exam]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = () => {
        if (!exam) return;
        setBusy(true);
        api.patch(`/perio-exams/${exam._id}`, { date, dentistId: dentistId || null, notes })
            .then((res) => onSaved(unwrap(res)))
            .catch((err) => setError(apiErrorMessage(err)))
            .finally(() => setBusy(false));
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{t('perio.examDetails')}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField
                    type="date"
                    size="small"
                    label={t('common.date')}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ max: toLocalDateString() }}
                />
                <TextField select size="small" label={t('appointments.dentist')} value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
                    <MenuItem value="">—</MenuItem>
                    {dentists.map((d: any) => (
                        <MenuItem key={d._id} value={staffRefId(d)}>
                            {d.lastName} {d.firstName}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    multiline
                    minRows={2}
                    label={t('patients.notes')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    inputProps={{ maxLength: 2000 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={save} disabled={busy || !date}>{t('common.save')}</Button>
            </DialogActions>
        </Dialog>
    );
};

/**
 * F12: the patient's periodontal exams. One exam at a time, saved tooth by
 * tooth as it is typed; the previous exam alongside to compare; printable.
 */
const PerioPanel: React.FC<{ patient: Patient }> = ({ patient }) => {
    const { t, i18n } = useTranslation();
    const can = usePermission();
    const canRecord = can('recordPerio');
    const canRemove = can('removePerio');

    const [list, setList] = useState<PerioExamListItem[] | null>(null);
    const [exam, setExam] = useState<PerioExam | null>(null);
    const [teeth, setTeeth] = useState<PerioTooth[]>([]);
    const [summary, setSummary] = useState<PerioSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [compare, setCompare] = useState(true);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [menu, setMenu] = useState<HTMLElement | null>(null);
    const [editing, setEditing] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [reason, setReason] = useState('');
    const [creating, setCreating] = useState(false);

    // Autosave: the teeth changed since the last save, and the latest teeth for the timer.
    const dirty = useRef(new Set<number>());
    const latest = useRef<{ examId: string | null; teeth: PerioTooth[] }>({ examId: null, teeth: [] });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saving = useRef(false);

    const loadList = useCallback(
        () =>
            api.get(`/patients/${patient._id}/perio-exams`)
                .then((res) => {
                    setList(unwrap(res));
                    setError(null);
                    return unwrap(res) as PerioExamListItem[];
                })
                .catch((err) => {
                    setError(apiErrorMessage(err));
                    return [] as PerioExamListItem[];
                }),
        [patient._id],
    );

    const open = useCallback((id: string) => {
        api.get(`/perio-exams/${id}`)
            .then((res) => {
                const data: PerioExam = unwrap(res);
                setExam(data);
                setTeeth(data.teeth);
                setSummary(data.summary);
                setSaveState('idle');
                latest.current = { examId: data._id, teeth: data.teeth };
                dirty.current.clear();
            })
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    useEffect(() => {
        loadList().then((items) => (items.length ? open(items[0]._id) : setExam(null)));
    }, [loadList, open]);

    const flush = useCallback(async () => {
        if (saving.current) return;
        const { examId } = latest.current;
        if (!examId || !dirty.current.size) return;
        saving.current = true;
        setSaveState('saving');
        let failed = false;
        for (const n of Array.from(dirty.current)) {
            dirty.current.delete(n);
            const tooth = latest.current.teeth.find((x) => x.toothNumber === n);
            if (!tooth) continue;
            const { toothNumber, ...body } = tooth;
            try {
                const res = await api.put(`/perio-exams/${examId}/teeth/${toothNumber}`, body);
                if (latest.current.examId === examId) setSummary(unwrap(res).summary);
            } catch (err) {
                failed = true;
                dirty.current.add(n);
                toast.error(apiErrorMessage(err));
                break;
            }
        }
        saving.current = false;
        setSaveState(failed ? 'error' : dirty.current.size ? 'saving' : 'saved');
        // Typed while saving: go again.
        if (!failed && dirty.current.size) flush();
    }, []);

    // Leaving the tab or the exam: save what is pending.
    useEffect(() => () => void flush(), [flush]);

    const onToothChange = (toothNumber: number, update: (tooth: PerioTooth) => PerioTooth) => {
        // The ref is the source of truth for typing and saving; the state only draws it.
        const next = latest.current.teeth.map((x) => (x.toothNumber === toothNumber ? update(x) : x));
        latest.current = { ...latest.current, teeth: next };
        setTeeth(next);
        dirty.current.add(toothNumber);
        setSaveState('saving');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, SAVE_DELAY);
    };

    const switchTo = async (id: string) => {
        if (timer.current) clearTimeout(timer.current);
        await flush();
        open(id);
    };

    const create = async () => {
        await flush();
        setCreating(true);
        api.post(`/patients/${patient._id}/perio-exams`, {})
            .then(async (res) => {
                const data: PerioExam = unwrap(res);
                await loadList();
                open(data._id);
            })
            .catch((err) => toast.error(apiErrorMessage(err)))
            .finally(() => setCreating(false));
    };

    const remove = () => {
        if (!exam) return;
        api.delete(`/perio-exams/${exam._id}`, { data: { reason } })
            .then(async () => {
                setRemoving(false);
                setReason('');
                toast.success(t('perio.removed'));
                dirty.current.clear();
                const items = await loadList();
                if (items.length) open(items[0]._id);
                else setExam(null);
            })
            .catch((err) => toast.error(apiErrorMessage(err)));
    };

    const previousTeeth = useMemo(
        () => (exam?.previous && compare ? new Map(exam.previous.teeth.map((x) => [x.toothNumber, x])) : null),
        [exam?.previous, compare],
    );

    if (!list) return error ? <Alert severity="error">{error}</Alert> : <LoadingSpinner />;

    if (!list.length || !exam) {
        return (
            <EmptyState
                title={t('perio.none')}
                description={t('perio.about')}
                actionLabel={canRecord ? t('perio.newExam') : undefined}
                onAction={canRecord && !creating ? create : undefined}
            />
        );
    }

    // Two exams on one day are told apart by the time they were started.
    const examLabel = (e: Pick<PerioExamListItem, 'date' | 'dentistId' | 'createdAt'>) => {
        const sameDay = list.filter((x) => x.date === e.date).length > 1;
        return `${formatDate(e.date, 'dd.MM.yyyy', i18n.language)}${sameDay ? ` ${formatDate(e.createdAt, 'HH:mm', i18n.language)}` : ''}${
            e.dentistId ? ` · ${staffName(e.dentistId)}` : ''
        }`;
    };

    return (
        <Box>
            {/* Printed on its own, in landscape. */}
            <GlobalStyles styles={{ '@media print': { '@page': { size: 'A4 landscape', margin: '10mm' } } }} />
            <Box sx={{ display: 'none', displayPrint: 'block', mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>{t('perio.title')}</Typography>
                <Typography variant="body2">
                    {getFullName(patient.firstName, patient.lastName, patient.patronymic)}
                    {patient.dateOfBirth ? ` · ${formatDate(patient.dateOfBirth, 'dd.MM.yyyy', i18n.language)}` : ''}
                    {` · ${examLabel(exam)}`}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2, displayPrint: 'none' }}>
                <TextField
                    select
                    size="small"
                    label={t('perio.exam')}
                    value={exam._id}
                    onChange={(e) => switchTo(e.target.value)}
                    sx={{ minWidth: 220 }}
                >
                    {list.map((e) => (
                        <MenuItem key={e._id} value={e._id}>{examLabel(e)}</MenuItem>
                    ))}
                </TextField>
                {exam.previous && (
                    <FormControlLabel
                        control={<Switch size="small" checked={compare} onChange={(e) => setCompare(e.target.checked)} />}
                        label={t('perio.compareWith', { date: formatDate(exam.previous.date, 'dd.MM.yyyy', i18n.language) })}
                    />
                )}
                <Box sx={{ flexGrow: 1 }} />
                {canRecord && (
                    <Typography variant="caption" color={saveState === 'error' ? 'error' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-live="polite">
                        {saveState === 'saving' && t('perio.saving')}
                        {saveState === 'saved' && (
                            <>
                                <SavedIcon fontSize="inherit" color="success" /> {t('perio.saved')}
                            </>
                        )}
                        {saveState === 'error' && (
                            <>
                                <ErrorIcon fontSize="inherit" /> {t('perio.notSaved')}
                                <Button size="small" onClick={flush}>{t('common.retry')}</Button>
                            </>
                        )}
                    </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button variant="outlined" size="small" startIcon={<PrintIcon />} onClick={() => window.print()}>
                        {t('perio.print')}
                    </Button>
                    {canRecord && (
                        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={create} disabled={creating}>
                            {t('perio.newExam')}
                        </Button>
                    )}
                    {canRecord && (
                        <Tooltip title={t('perio.moreActions')}>
                            <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label={t('perio.moreActions')}>
                                <MoreIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
                <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                    <MenuItem onClick={() => { setMenu(null); setEditing(true); }}>{t('perio.examDetails')}</MenuItem>
                    {canRemove && <MenuItem onClick={() => { setMenu(null); setRemoving(true); }} sx={{ color: 'error.main' }}>{t('perio.remove')}</MenuItem>}
                </Menu>
            </Box>

            {exam.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>{exam.notes}</Typography>
            )}
            {canRecord && (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5, displayPrint: 'none' }}>
                    {t('perio.keyboardHint')}
                </Typography>
            )}

            <PerioGrid teeth={teeth} previous={previousTeeth} editable={canRecord} onChange={onToothChange} />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start', '@media print': { breakInside: 'avoid' } }}>
                <Card variant="outlined" sx={{ minWidth: 260 }}>
                    <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{t('perio.summary')}</Typography>
                        {summary && (
                            <SummaryTable
                                summary={summary}
                                previous={compare ? exam.previous?.summary : null}
                                previousDate={exam.previous?.date}
                            />
                        )}
                    </CardContent>
                </Card>
                <Box sx={{ display: 'grid', gap: 0.75, fontSize: 12, color: 'text.secondary', pt: 1 }}>
                    <Box><Box component="span" sx={{ color: 'warning.dark', fontWeight: 700 }}>4–5</Box> {t('perio.legendModerate')}</Box>
                    <Box><Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>6+</Box> {t('perio.legendDeep')}</Box>
                    <Box>{t('perio.legendCal')}</Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', mr: 0.5, verticalAlign: 'middle' }} />{t('perio.bop')}</span>
                        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: 3, borderColor: 'warning.main', mr: 0.5, verticalAlign: 'middle' }} />{t('perio.sup')}</span>
                        <span><Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: 'info.main', mr: 0.5, verticalAlign: 'middle' }} />{t('perio.plaque')}</span>
                    </Box>
                    {compare && exam.previous && <Box>{t('perio.legendCompare')}</Box>}
                    <Box>{t('perio.recordedBy', { name: staffName(exam.recordedBy) })}</Box>
                </Box>
            </Box>

            <ExamDetailsDialog
                exam={exam}
                open={editing}
                onClose={() => setEditing(false)}
                onSaved={(data) => {
                    setEditing(false);
                    toast.success(t('toast.saveSuccess'));
                    setExam((e) => (e ? { ...e, date: data.date, dentistId: data.dentistId, notes: data.notes, previous: data.previous } : e));
                    loadList();
                }}
            />

            <Dialog open={removing} onClose={() => setRemoving(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('perio.remove')}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>{t('perio.removeExplain', { exam: examLabel(exam) })}</Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label={t('perio.removeReason')}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        inputProps={{ maxLength: 500 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRemoving(false)}>{t('common.cancel')}</Button>
                    <Button color="error" variant="contained" disabled={reason.trim().length < 3} onClick={remove}>
                        {t('perio.remove')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PerioPanel;
