import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Box, Button } from '@mui/material';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { LoadingSpinner, PageHeader } from '../../components/ui';
import { useHttpState } from '../../hooks';
import { getFullName } from '../../utils/formatters';
import { patientToForm } from './patientForm';
import PatientEditor from './PatientEditor';

/** Status is not edited here: it has its own audited dialog on the patient page. */
const PatientEditPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { id } = useParams<{ id: string }>();

    const storedPatient = useSelector((state: RootState) => state.patients.current);
    // Only ever edit the patient named in the URL — not whoever was loaded last.
    const patient = storedPatient && storedPatient._id === id ? storedPatient : null;
    const { loading, success, clearSuccess } = useHttpState('UPDATE_PATIENT');
    const { loading: loadingPatient, error: loadError } = useHttpState('GET_PATIENT');

    const defaultValues = useMemo(() => (patient ? patientToForm(patient) : undefined), [patient]);

    useEffect(() => {
        if (id) dispatch(patientsActions.getPatient(id));
    }, [id, dispatch]);

    useEffect(() => {
        if (success) {
            clearSuccess();
            navigate(`/patients/${id}`);
        }
    }, [success, id, navigate, clearSuccess]);

    if (!patient) {
        if (loadError && !loadingPatient) {
            return (
                <Box>
                    <PageHeader title={t('patients.title')} />
                    <Alert
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={() => navigate('/patients')}>
                                {t('common.back')}
                            </Button>
                        }
                    >
                        {loadError}
                    </Alert>
                </Box>
            );
        }
        // Wait for the right patient, so the fields are never briefly empty or another patient's.
        return <LoadingSpinner fullPage />;
    }

    return (
        <PatientEditor
            title={`${t('common.edit')} — ${getFullName(patient.firstName, patient.lastName, patient.patronymic)}`}
            defaultValues={defaultValues}
            patientId={patient._id}
            saving={loading}
            onSubmit={(payload) => id && dispatch(patientsActions.updatePatient({ id, data: payload as any }))}
            onCancel={() => navigate(`/patients/${id}`)}
        />
    );
};

export default PatientEditPage;
