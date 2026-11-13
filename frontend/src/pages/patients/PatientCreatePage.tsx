import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { RootState } from '../../store';
import { patientsActions } from '../../store/patients';
import { useHttpState } from '../../hooks';
import { GuardianInput } from '../../components/family/GuardianDialog';
import { apiErrorMessage } from '../../utils/apiError';
import PatientEditor from './PatientEditor';

const PatientCreatePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { loading, success, clearSuccess } = useHttpState('CREATE_PATIENT');
    const created = useSelector((state: RootState) => state.patients.current);
    // Guardians (F8) are added once the patient exists.
    const [guardians, setGuardians] = useState<GuardianInput[]>([]);
    const pending = useRef<GuardianInput[]>([]);

    useEffect(() => {
        if (!success || !created?._id) return;
        clearSuccess();
        const toAdd = pending.current;
        if (!toAdd.length) {
            navigate('/patients');
            return;
        }
        (async () => {
            for (const g of toAdd) {
                try {
                    await api.post(
                        `/patients/${created._id}/guardians`,
                        g.patientId
                            ? { patientId: g.patientId, relationship: g.relationship, isPrimary: g.isPrimary }
                            : { name: g.name, phone: g.phone, relationship: g.relationship, isPrimary: g.isPrimary },
                    );
                } catch (err) {
                    toast.error(`${g.label ?? g.name}: ${apiErrorMessage(err)}`);
                }
            }
            // To the new patient's page, where the family card shows the result.
            navigate(`/patients/${created._id}`);
        })();
    }, [success, created, navigate, clearSuccess]);

    return (
        <PatientEditor
            title={t('patients.addPatient')}
            saving={loading}
            onSubmit={(payload) => {
                pending.current = guardians;
                dispatch(patientsActions.createPatient(payload as any));
            }}
            onCancel={() => navigate('/patients')}
            guardians={guardians}
            onGuardiansChange={setGuardians}
        />
    );
};

export default PatientCreatePage;
