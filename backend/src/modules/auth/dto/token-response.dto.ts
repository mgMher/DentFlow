import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
    @ApiProperty()
    accessToken: string;

    @ApiProperty()
    refreshToken: string;

    @ApiProperty({
        example: {
            _id: '665a1b2c3d4e5f6a7b8c9d0e',
            email: 'admin@brightsmile.com',
            firstName: 'Armen',
            lastName: 'Hakobyan',
            role: 'clinic_admin',
            clinicId: '665a1b2c3d4e5f6a7b8c9d0f',
        },
    })
    user: {
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        clinicId: string;
    };
}
