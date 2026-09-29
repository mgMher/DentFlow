import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role } from 'src/common/decorators';
import { User, UserDocument } from '../auth/auth.schema';
import { UserProfile, UserProfileDocument } from './user.schema';
import {
    CreateUserDto,
    QueryUserDto,
    UpdateAvailabilityDto,
    UpdateUserDto,
} from './dto';

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * Errors carry a stable `code` next to the message so the UI can translate
 * them; the message stays as the developer-facing fallback.
 */
const errorBody = (code: string, message: string) => ({ code, message });

/** Escapes a user-supplied search term so it can be used inside a RegExp. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Availability is stored one entry per weekday, so a day the user switched off
 * is simply absent. Overlapping or zero-length ranges are rejected rather than
 * stored, because the scheduler reads these as bookable windows.
 */
const assertValidAvailability = (
    days: { dayOfWeek: number; startTime: string; endTime: string }[],
) => {
    const seen = new Set<number>();
    for (const day of days) {
        if (seen.has(day.dayOfWeek)) {
            throw new BadRequestException(
                errorBody('duplicateAvailabilityDay', `Day ${day.dayOfWeek} is listed twice`),
            );
        }
        seen.add(day.dayOfWeek);

        if (day.startTime >= day.endTime) {
            throw new BadRequestException(
                errorBody(
                    'availabilityEndBeforeStart',
                    `Day ${day.dayOfWeek}: end time must be after start time`,
                ),
            );
        }
    }
};

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfileDocument>,
        @InjectModel(User.name) private readonly authModel: Model<UserDocument>,
    ) {}

    /**
     * Create a new user within a clinic.
     * Creates both the auth record (User) and the profile record (UserProfile).
     */
    async create(clinicId: string, dto: CreateUserDto): Promise<UserProfileDocument> {
        const email = dto.email.toLowerCase();

        // Check for existing auth record with the same email
        const existingAuth = await this.authModel.findOne({ email }).lean();
        if (existingAuth) {
            throw new ConflictException(
                errorBody('staffEmailTaken', 'A user with this email already exists'),
            );
        }

        // Check for existing profile within this clinic
        const existingProfile = await this.userProfileModel
            .findOne({ clinicId: new Types.ObjectId(clinicId), email })
            .lean();
        if (existingProfile) {
            throw new ConflictException(
                errorBody('staffEmailTaken', 'A user with this email already exists in this clinic'),
            );
        }

        const availability = dto.defaultAvailability || [];
        assertValidAvailability(availability);

        const hashedPassword = await bcrypt.hash(dto.password, 12);

        // Create the auth record
        const authRecord = await this.authModel.create({
            email,
            password: hashedPassword,
            clinicId: new Types.ObjectId(clinicId),
            role: dto.role,
            firstName: dto.firstName,
            lastName: dto.lastName,
            patronymic: dto.patronymic || '',
            isActive: true,
        });

        try {
            return await this.userProfileModel.create({
                clinicId: new Types.ObjectId(clinicId),
                authId: authRecord._id,
                firstName: dto.firstName,
                lastName: dto.lastName,
                patronymic: dto.patronymic || '',
                email,
                phone: dto.phone || '',
                role: dto.role,
                specialization: dto.role === Role.DENTIST ? dto.specialization || '' : '',
                licenseNumber: dto.licenseNumber || '',
                avatar: dto.avatar || '',
                isActive: true,
                schedule: { defaultAvailability: availability },
            });
        } catch (err) {
            // Without a transaction the auth record would otherwise survive as a
            // login with no profile, permanently blocking that email address.
            await this.authModel.findByIdAndDelete(authRecord._id);
            throw err;
        }
    }

    /**
     * List users in a clinic with pagination, search and role/status filters.
     * Search matches firstName, lastName, email, phone and specialization.
     */
    async findAll(
        clinicId: string,
        filters?: QueryUserDto,
    ): Promise<PaginatedResult<UserProfileDocument>> {
        const page = Math.max(1, filters?.page || 1);
        const limit = Math.min(100, Math.max(1, filters?.limit || 20));
        const skip = (page - 1) * limit;

        const query: Record<string, any> = {
            clinicId: new Types.ObjectId(clinicId),
        };

        // `all` is the only value that lists deactivated accounts alongside active ones.
        const status = filters?.status || 'active';
        if (status !== 'all') {
            query.isActive = status === 'active';
        }

        if (filters?.role) {
            query.role = filters.role;
        }

        const search = filters?.search?.trim();
        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { patronymic: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { specialization: searchRegex },
            ];
        }

        const [data, total] = await Promise.all([
            this.userProfileModel
                .find(query)
                .sort({ lastName: 1, firstName: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.userProfileModel.countDocuments(query),
        ]);

        return {
            data: data as UserProfileDocument[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        };
    }

    /**
     * Find a single user by ID within a clinic.
     */
    async findById(clinicId: string, userId: string): Promise<UserProfileDocument> {
        const profile = await this.userProfileModel
            .findOne({
                _id: new Types.ObjectId(userId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .lean();

        if (!profile) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        return profile as UserProfileDocument;
    }

    /**
     * Update a user's profile within a clinic.
     * Also syncs relevant fields back to the auth record.
     */
    async update(
        clinicId: string,
        userId: string,
        dto: UpdateUserDto,
    ): Promise<UserProfileDocument> {
        const existingProfile = await this.userProfileModel.findOne({
            _id: new Types.ObjectId(userId),
            clinicId: new Types.ObjectId(clinicId),
        });

        if (!existingProfile) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        // If changing email, check for uniqueness across logins and within the clinic
        if (dto.email && dto.email !== existingProfile.email) {
            const [authTaken, profileTaken] = await Promise.all([
                this.authModel
                    .findOne({ email: dto.email, _id: { $ne: existingProfile.authId } })
                    .lean(),
                this.userProfileModel
                    .findOne({
                        clinicId: new Types.ObjectId(clinicId),
                        email: dto.email,
                        _id: { $ne: existingProfile._id },
                    })
                    .lean(),
            ]);
            if (authTaken || profileTaken) {
                throw new ConflictException(
                    errorBody('staffEmailTaken', 'A user with this email already exists'),
                );
            }
        }

        const nextRole = dto.role ?? existingProfile.role;

        if (dto.role && dto.role !== existingProfile.role) {
            await this.assertNotLastAdmin(clinicId, existingProfile, 'roleChange');
        }
        if (dto.isActive === false && existingProfile.isActive) {
            await this.assertNotLastAdmin(clinicId, existingProfile, 'deactivate');
        }

        if (dto.defaultAvailability) {
            assertValidAvailability(dto.defaultAvailability);
        }

        // Build profile update payload
        const profileUpdate: Record<string, any> = {};
        if (dto.firstName !== undefined) profileUpdate.firstName = dto.firstName;
        if (dto.lastName !== undefined) profileUpdate.lastName = dto.lastName;
        if (dto.patronymic !== undefined) profileUpdate.patronymic = dto.patronymic;
        if (dto.email !== undefined) profileUpdate.email = dto.email;
        if (dto.phone !== undefined) profileUpdate.phone = dto.phone;
        if (dto.role !== undefined) profileUpdate.role = dto.role;
        if (dto.licenseNumber !== undefined) profileUpdate.licenseNumber = dto.licenseNumber;
        if (dto.avatar !== undefined) profileUpdate.avatar = dto.avatar;
        if (dto.isActive !== undefined) profileUpdate.isActive = dto.isActive;
        if (dto.defaultAvailability !== undefined) {
            profileUpdate['schedule.defaultAvailability'] = dto.defaultAvailability;
        }
        // Specialization only means something for a dentist; demoting someone out
        // of that role clears it so the list column cannot go stale.
        if (nextRole !== Role.DENTIST) {
            profileUpdate.specialization = '';
        } else if (dto.specialization !== undefined) {
            profileUpdate.specialization = dto.specialization;
        }

        const updatedProfile = await this.userProfileModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(userId), clinicId: new Types.ObjectId(clinicId) },
                { $set: profileUpdate },
                { new: true, runValidators: true },
            )
            .lean();

        if (!updatedProfile) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        // Sync fields that also live on the auth record
        const authUpdate: Record<string, any> = {};
        if (dto.firstName !== undefined) authUpdate.firstName = dto.firstName;
        if (dto.lastName !== undefined) authUpdate.lastName = dto.lastName;
        if (dto.patronymic !== undefined) authUpdate.patronymic = dto.patronymic;
        if (dto.email !== undefined) authUpdate.email = dto.email;
        if (dto.role !== undefined) authUpdate.role = dto.role;
        if (dto.isActive !== undefined) authUpdate.isActive = dto.isActive;

        if (Object.keys(authUpdate).length > 0) {
            await this.authModel.findByIdAndUpdate(existingProfile.authId, { $set: authUpdate });
        }

        return updatedProfile as UserProfileDocument;
    }

    /**
     * Activate or deactivate a user, keeping the auth record in step so a
     * deactivated member can no longer log in.
     */
    async setActive(
        clinicId: string,
        userId: string,
        isActive: boolean,
        actingAuthId: string,
    ): Promise<UserProfileDocument> {
        const profile = await this.userProfileModel
            .findOne({
                _id: new Types.ObjectId(userId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .lean();

        if (!profile) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        if (!isActive && profile.authId?.toString() === actingAuthId) {
            throw new BadRequestException(
                errorBody('cannotDeactivateSelf', 'You cannot deactivate your own account'),
            );
        }

        if (profile.isActive === isActive) {
            return profile as UserProfileDocument;
        }

        if (!isActive) {
            await this.assertNotLastAdmin(clinicId, profile, 'deactivate');
        }

        const [updated] = await Promise.all([
            this.userProfileModel
                .findByIdAndUpdate(profile._id, { $set: { isActive } }, { new: true })
                .lean(),
            this.authModel.findByIdAndUpdate(profile.authId, { $set: { isActive } }),
        ]);

        return updated as UserProfileDocument;
    }

    /**
     * Replace a member's weekly availability. Days the user switched off are
     * simply absent from the array.
     */
    async updateAvailability(
        clinicId: string,
        userId: string,
        dto: UpdateAvailabilityDto,
    ): Promise<UserProfileDocument> {
        assertValidAvailability(dto.defaultAvailability);

        const updated = await this.userProfileModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(userId), clinicId: new Types.ObjectId(clinicId) },
                { $set: { 'schedule.defaultAvailability': dto.defaultAvailability } },
                { new: true, runValidators: true },
            )
            .lean();

        if (!updated) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        return updated as UserProfileDocument;
    }

    /**
     * Soft-delete a user by setting isActive to false.
     * Also deactivates the corresponding auth record.
     */
    async deactivate(
        clinicId: string,
        userId: string,
        actingAuthId: string,
    ): Promise<{ message: string }> {
        const profile = await this.userProfileModel
            .findOne({
                _id: new Types.ObjectId(userId),
                clinicId: new Types.ObjectId(clinicId),
            })
            .lean();

        if (!profile) {
            throw new NotFoundException(errorBody('staffNotFound', 'User not found'));
        }

        if (!profile.isActive) {
            throw new BadRequestException(
                errorBody('staffAlreadyInactive', 'User is already deactivated'),
            );
        }

        await this.setActive(clinicId, userId, false, actingAuthId);

        return { message: 'User deactivated successfully' };
    }

    /**
     * Find all active dentists within a clinic.
     */
    async findDentists(clinicId: string): Promise<UserProfileDocument[]> {
        const dentists = await this.userProfileModel
            .find({
                clinicId: new Types.ObjectId(clinicId),
                role: Role.DENTIST,
                isActive: true,
            })
            .sort({ lastName: 1, firstName: 1 })
            .lean();

        return dentists as UserProfileDocument[];
    }

    /** Resolves the profile behind a login, so a member can act on their own record. */
    async findByAuthId(clinicId: string, authId: string): Promise<UserProfileDocument | null> {
        return this.userProfileModel
            .findOne({
                clinicId: new Types.ObjectId(clinicId),
                authId: new Types.ObjectId(authId),
            })
            .lean() as Promise<UserProfileDocument | null>;
    }

    /**
     * A clinic with no active administrator can no longer manage its own staff,
     * so the last one cannot demote or deactivate themselves out of the role.
     */
    private async assertNotLastAdmin(
        clinicId: string,
        profile: Pick<UserProfileDocument, '_id' | 'role'>,
        action: 'roleChange' | 'deactivate',
    ): Promise<void> {
        if (profile.role !== Role.CLINIC_ADMIN) return;

        const remainingAdmins = await this.userProfileModel.countDocuments({
            clinicId: new Types.ObjectId(clinicId),
            role: Role.CLINIC_ADMIN,
            isActive: true,
            _id: { $ne: profile._id },
        });

        if (remainingAdmins === 0) {
            throw new ForbiddenException(
                errorBody(
                    'lastClinicAdmin',
                    action === 'deactivate'
                        ? 'The clinic must keep at least one active administrator'
                        : 'The last clinic administrator cannot change their own role',
                ),
            );
        }
    }
}
