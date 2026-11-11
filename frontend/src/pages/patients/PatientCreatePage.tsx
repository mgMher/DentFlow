import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { patientsActions } from '../../store/patients';
import { useHttpState } from '../../hooks';
import PatientEditor from './PatientEditor';

const PatientCreatePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loading, success, clearSuccess } = useHttpState('CREATE_PATIENT');

    useEffect(() => {
        if (success) {
            clearSuccess();
            navigate('/patients');
        }
    }, [success, navigate, clearSuccess]);

    return (
        <PatientEditor
            title={t('patients.addPatient')}
            saving={loading}
            onSubmit={(payload) => dispatch(patientsActions.createPatient(payload as any))}
            onCancel={() => navigate('/patients')}
        />
    );
};

export default PatientCreatePage;
