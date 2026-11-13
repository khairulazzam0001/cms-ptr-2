import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { TranslateDto } from './dto';
import { TranslateService } from './translate.service';

@Controller('translate')
export class TranslateController {
  constructor(private svc: TranslateService) {}

  // Terjemahkan subject (teks) dan/atau html sekaligus.
  @Post()
  async translate(@Body() dto: TranslateDto) {
    if (!dto.subject?.trim() && !dto.html?.trim()) {
      throw new BadRequestException('subject atau html wajib diisi');
    }

    const [subject, html] = await Promise.all([
      dto.subject !== undefined
        ? this.svc.translateText(dto.subject, dto.target_language, dto.source_language)
        : Promise.resolve(undefined),
      dto.html !== undefined
        ? this.svc.translateHtml(dto.html, dto.target_language, dto.source_language)
        : Promise.resolve(undefined),
    ]);

    return { subject, html };
  }
}
