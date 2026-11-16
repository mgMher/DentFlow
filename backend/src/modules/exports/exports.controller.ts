import { Body, Controller, HttpCode, HttpStatus, Post, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowInSupport, AllowWhenReadOnly } from 'src/common/decorators';
import { ExportDto } from './dto/export.dto';
import { ExportsService } from './exports.service';

/**
 * F11: any signed-in user can turn a table they are already allowed to see
 * into a file. Nothing is read from the database here.
 */
@ApiTags('Exports')
@ApiBearerAuth()
@Controller('exports')
@AllowWhenReadOnly()
@AllowInSupport()
export class ExportsController {
    constructor(private readonly exports: ExportsService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Write tables as an Excel workbook or a CSV file' })
    async export(@Body() dto: ExportDto) {
        const file = await this.exports.render(dto);
        return new StreamableFile(file.data, {
            type: file.mimeType,
            length: file.data.length,
            disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        });
    }
}
