// TEMPLATE master — copy folder ini untuk tiap tabel master baru.
// Contoh: copy example-master -> products, lalu rename class + kolom sesuai struktur tabel darimu.
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('example_masters')
export class ExampleMaster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nama: string;

  @Column({ length: 50, nullable: true })
  kode?: string;

  // Contoh kolom file/dokumen: simpan URL hasil POST /api/uploads
  @Column({ nullable: true })
  dokumenUrl?: string;

  @Column({ type: 'text', nullable: true })
  keterangan?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
