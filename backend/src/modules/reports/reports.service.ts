import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Patient, PatientDocument } from '../patients/patient.schema';
import { Appointment, AppointmentDocument, AppointmentStatus } from '../appointments/appointment.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../billing/invoice.schema';
import { Payment, PaymentDocument } from '../billing/payment.schema';
import { Treatment, TreatmentDocument } from '../treatments/treatment.schema';

@Injectable()
export class ReportsService {
    constructor(
        @InjectModel(Patient.name)
        private readonly patientModel: Model<PatientDocument>,
        @InjectModel(Appointment.name)
        private readonly appointmentModel: Model<AppointmentDocument>,
        @InjectModel(Invoice.name)
        private readonly invoiceModel: Model<InvoiceDocument>,
        @InjectModel(Payment.name)
        private readonly paymentModel: Model<PaymentDocument>,
        @InjectModel(Treatment.name)
        private readonly treatmentModel: Model<TreatmentDocument>,
    ) {}

    async getPatientStats(
        clinicId: string,
        startDate?: string,
        endDate?: string,
    ) {
        const clinicObjId = new Types.ObjectId(clinicId);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const dateFilter: Record<string, any> = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const [totalPatients, newThisMonth, activePatients, genderDistribution] = await Promise.all([
            this.patientModel.countDocuments({ clinicId: clinicObjId }).exec(),
            this.patientModel
                .countDocuments({
                    clinicId: clinicObjId,
                    createdAt: { $gte: startOfMonth },
                })
                .exec(),
            this.patientModel
                .countDocuments({ clinicId: clinicObjId, isActive: true })
                .exec(),
            this.patientModel
                .aggregate([
                    { $match: { clinicId: clinicObjId } },
                    {
                        $group: {
                            _id: '$gender',
                            count: { $sum: 1 },
                        },
                    },
                ])
                .exec(),
        ]);

        const genderMap: Record<string, number> = {};
        for (const item of genderDistribution) {
            genderMap[item._id] = item.count;
        }

        return {
            totalPatients,
            newThisMonth,
            activePatients,
            genderDistribution: genderMap,
        };
    }

    async getRevenueReport(
        clinicId: string,
        startDate: string,
        endDate: string,
        groupBy: 'day' | 'week' | 'month' = 'month',
    ) {
        const clinicObjId = new Types.ObjectId(clinicId);
        const start = new Date(startDate);
        const end = new Date(endDate);

        let dateGroupExpression: Record<string, any>;
        switch (groupBy) {
            case 'day':
                dateGroupExpression = {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                    day: { $dayOfMonth: '$date' },
                };
                break;
            case 'week':
                dateGroupExpression = {
                    year: { $isoWeekYear: '$date' },
                    week: { $isoWeek: '$date' },
                };
                break;
            case 'month':
            default:
                dateGroupExpression = {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                };
                break;
        }

        const [revenueOverTime, byPaymentMethod, totals] = await Promise.all([
            this.paymentModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            date: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: dateGroupExpression,
                            total: { $sum: '$amount' },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
                ])
                .exec(),
            this.paymentModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            date: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: '$method',
                            total: { $sum: '$amount' },
                            count: { $sum: 1 },
                        },
                    },
                ])
                .exec(),
            this.paymentModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            date: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$amount' },
                            totalPayments: { $sum: 1 },
                        },
                    },
                ])
                .exec(),
        ]);

        const byMethod: Record<string, { total: number; count: number }> = {};
        for (const item of byPaymentMethod) {
            byMethod[item._id] = { total: item.total, count: item.count };
        }

        return {
            totalRevenue: totals[0]?.totalRevenue || 0,
            totalPayments: totals[0]?.totalPayments || 0,
            revenueOverTime,
            byPaymentMethod: byMethod,
        };
    }

    async getAppointmentStats(
        clinicId: string,
        startDate: string,
        endDate: string,
    ) {
        const clinicObjId = new Types.ObjectId(clinicId);
        const start = new Date(startDate);
        const end = new Date(endDate);

        const statusCounts = await this.appointmentModel
            .aggregate([
                {
                    $match: {
                        clinicId: clinicObjId,
                        startTime: { $gte: start, $lte: end },
                    },
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ])
            .exec();

        const statusMap: Record<string, number> = {};
        let total = 0;
        for (const item of statusCounts) {
            statusMap[item._id] = item.count;
            total += item.count;
        }

        return {
            total,
            completed: statusMap[AppointmentStatus.COMPLETED] || 0,
            cancelled: statusMap[AppointmentStatus.CANCELLED] || 0,
            noShow: statusMap[AppointmentStatus.NO_SHOW] || 0,
            scheduled: statusMap[AppointmentStatus.SCHEDULED] || 0,
            confirmed: statusMap[AppointmentStatus.CONFIRMED] || 0,
            inProgress: statusMap[AppointmentStatus.IN_PROGRESS] || 0,
            completionRate: total > 0
                ? Math.round(((statusMap[AppointmentStatus.COMPLETED] || 0) / total) * 100)
                : 0,
            cancellationRate: total > 0
                ? Math.round(((statusMap[AppointmentStatus.CANCELLED] || 0) / total) * 100)
                : 0,
            noShowRate: total > 0
                ? Math.round(((statusMap[AppointmentStatus.NO_SHOW] || 0) / total) * 100)
                : 0,
        };
    }

    async getDentistPerformance(
        clinicId: string,
        startDate?: string,
        endDate?: string,
    ) {
        const clinicObjId = new Types.ObjectId(clinicId);

        const dateMatch: Record<string, any> = {};
        if (startDate) dateMatch.$gte = new Date(startDate);
        if (endDate) dateMatch.$lte = new Date(endDate);

        const appointmentMatch: Record<string, any> = { clinicId: clinicObjId };
        if (startDate || endDate) {
            appointmentMatch.startTime = dateMatch;
        }

        const [appointmentsPerDentist, revenuePerDentist] = await Promise.all([
            this.appointmentModel
                .aggregate([
                    { $match: appointmentMatch },
                    {
                        $group: {
                            _id: '$dentistId',
                            totalAppointments: { $sum: 1 },
                            completed: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0],
                                },
                            },
                            cancelled: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', AppointmentStatus.CANCELLED] }, 1, 0],
                                },
                            },
                        },
                    },
                    {
                        $lookup: {
                            from: 'user_profiles',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'dentist',
                        },
                    },
                    { $unwind: { path: '$dentist', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 1,
                            dentistName: {
                                $concat: [
                                    { $ifNull: ['$dentist.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$dentist.lastName', ''] },
                                ],
                            },
                            totalAppointments: 1,
                            completed: 1,
                            cancelled: 1,
                        },
                    },
                    { $sort: { totalAppointments: -1 } },
                ])
                .exec(),
            this.invoiceModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            status: { $in: [InvoiceStatus.PAID, InvoiceStatus.PARTIAL] },
                            ...(startDate || endDate
                                ? { createdAt: dateMatch }
                                : {}),
                        },
                    },
                    {
                        $lookup: {
                            from: 'appointments',
                            localField: 'appointmentId',
                            foreignField: '_id',
                            as: 'appointment',
                        },
                    },
                    { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
                    {
                        $group: {
                            _id: '$appointment.dentistId',
                            totalRevenue: { $sum: '$paidAmount' },
                            invoiceCount: { $sum: 1 },
                        },
                    },
                    {
                        $lookup: {
                            from: 'user_profiles',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'dentist',
                        },
                    },
                    { $unwind: { path: '$dentist', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 1,
                            dentistName: {
                                $concat: [
                                    { $ifNull: ['$dentist.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$dentist.lastName', ''] },
                                ],
                            },
                            totalRevenue: 1,
                            invoiceCount: 1,
                        },
                    },
                    { $sort: { totalRevenue: -1 } },
                ])
                .exec(),
        ]);

        return {
            appointmentsPerDentist,
            revenuePerDentist,
        };
    }

    async getTreatmentStats(
        clinicId: string,
        startDate?: string,
        endDate?: string,
    ) {
        const clinicObjId = new Types.ObjectId(clinicId);

        const dateMatch: Record<string, any> = {};
        if (startDate) dateMatch.$gte = new Date(startDate);
        if (endDate) dateMatch.$lte = new Date(endDate);

        const appointmentMatch: Record<string, any> = {
            clinicId: clinicObjId,
            status: AppointmentStatus.COMPLETED,
        };
        if (startDate || endDate) {
            appointmentMatch.startTime = dateMatch;
        }

        const [popularTreatments, revenueByTreatment] = await Promise.all([
            this.appointmentModel
                .aggregate([
                    { $match: appointmentMatch },
                    { $unwind: '$treatmentIds' },
                    {
                        $group: {
                            _id: '$treatmentIds',
                            count: { $sum: 1 },
                        },
                    },
                    {
                        $lookup: {
                            from: 'treatments',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'treatment',
                        },
                    },
                    { $unwind: { path: '$treatment', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 1,
                            name: '$treatment.name',
                            category: '$treatment.category',
                            count: 1,
                        },
                    },
                    { $sort: { count: -1 } },
                    { $limit: 20 },
                ])
                .exec(),
            this.invoiceModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            status: { $in: [InvoiceStatus.PAID, InvoiceStatus.PARTIAL] },
                            ...(startDate || endDate
                                ? { createdAt: dateMatch }
                                : {}),
                        },
                    },
                    { $unwind: '$items' },
                    {
                        $group: {
                            _id: '$items.treatmentId',
                            totalRevenue: { $sum: '$items.total' },
                            count: { $sum: '$items.quantity' },
                        },
                    },
                    {
                        $lookup: {
                            from: 'treatments',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'treatment',
                        },
                    },
                    { $unwind: { path: '$treatment', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 1,
                            name: '$treatment.name',
                            category: '$treatment.category',
                            totalRevenue: 1,
                            count: 1,
                        },
                    },
                    { $sort: { totalRevenue: -1 } },
                    { $limit: 20 },
                ])
                .exec(),
        ]);

        return {
            popularTreatments,
            revenueByTreatment,
        };
    }

    async getDashboardSummary(clinicId: string) {
        const clinicObjId = new Types.ObjectId(clinicId);
        const now = new Date();

        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const [
            todayAppointments,
            monthRevenue,
            activePatients,
            upcomingAppointments,
        ] = await Promise.all([
            this.appointmentModel
                .countDocuments({
                    clinicId: clinicObjId,
                    startTime: { $gte: startOfDay, $lte: endOfDay },
                    status: { $ne: AppointmentStatus.CANCELLED },
                })
                .exec(),
            this.paymentModel
                .aggregate([
                    {
                        $match: {
                            clinicId: clinicObjId,
                            date: { $gte: startOfMonth, $lte: endOfMonth },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' },
                        },
                    },
                ])
                .exec(),
            this.patientModel
                .countDocuments({ clinicId: clinicObjId, isActive: true })
                .exec(),
            this.appointmentModel
                .find({
                    clinicId: clinicObjId,
                    startTime: { $gte: now },
                    status: {
                        $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
                    },
                })
                .sort({ startTime: 1 })
                .limit(5)
                .populate('patientId', 'firstName lastName')
                .populate('dentistId', 'firstName lastName')
                .lean(),
        ]);

        return {
            todayAppointments,
            monthRevenue: monthRevenue[0]?.total || 0,
            activePatients,
            upcomingAppointments,
        };
    }
}
