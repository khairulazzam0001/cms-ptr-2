import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UploadsModule } from './modules/uploads/uploads.module';
// IMPORT MASTER BARU DI SINI (contoh):
// import { ProductsModule } from './modules/masters/products/products.module';
import { ExampleMasterModule } from './modules/masters/example-master/example-master.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { SheetsModule } from './modules/sheets/sheets.module';
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASS ?? '',
      database: process.env.DB_NAME ?? 'cms_master',
      autoLoadEntities: true,
      synchronize: true, // DEV saja. Production: matikan + pakai migration
    }),
    AuthModule,
    UsersModule,
    UploadsModule,
    ExampleMasterModule,
    AssessmentModule,
    SheetsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
