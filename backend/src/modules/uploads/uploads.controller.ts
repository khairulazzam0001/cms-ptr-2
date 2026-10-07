import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

function uploadOptions(subdir = '') {
  return {
    storage: diskStorage({
      destination: (_req: any, _file: any, cb: any) => {
        const base = process.env.UPLOAD_DIR ?? './uploads';
        const dest = join(process.cwd(), base, subdir);
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (_req: any, file: any, cb: any) => {
        const uniq = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniq}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: Number(process.env.MAX_FILE_MB ?? 10) * 1024 * 1024 },
  };
}

@Controller('uploads')
export class UploadsController {
  // POST /api/uploads  (form-data key: file) -> { url, filename }
  @Post()
  @UseInterceptors(FileInterceptor('file', uploadOptions('dokumen')))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { filename: file.filename, url: `/uploads/dokumen/${file.filename}`, size: file.size, mimetype: file.mimetype };
  }

  // POST /api/uploads/gambar (khusus gambar, validasi ringan di frontend + backend bisa ditambah fileFilter)
  @Post('gambar')
  @UseInterceptors(FileInterceptor('file', uploadOptions('gambar')))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return { filename: file.filename, url: `/uploads/gambar/${file.filename}`, size: file.size, mimetype: file.mimetype };
  }
}
