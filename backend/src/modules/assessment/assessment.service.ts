import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PaginationDto, paginateResponse } from '../../common/dto/pagination.dto';
import {
  CompetencyQueryDto,
  SimulationQueryDto,
  AddCompetencyToDesignDto,
  AddSimulationToDesignDto,
  CreateAssessmentDesignDto,
  CreateCompetencyDto,
  CreateDesignDto,
  CreateLevelDto,
  CreateSimulationDto,
  UpdateAssessmentDesignDto,
  UpdateCompetencyDto,
  UpdateDesignDto,
  UpdateLevelDto,
  UpdateSimulationDto,
} from './dto';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Competency,
  Design,
  Level,
  Simulation,
} from './entities';

function applySearch(qb: any, alias: string, cols: string[], search?: string) {
  if (!search) return;
  qb.andWhere(
    new Brackets((sqb: any) => {
      cols.forEach((c, i) => {
        const cond = `${alias}.${c} LIKE :s`;
        if (i === 0) sqb.where(cond, { s: `%${search}%` });
        else sqb.orWhere(cond, { s: `%${search}%` });
      });
    }),
  );
}

@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(Level) private levels: Repository<Level>,
    @InjectRepository(Design) private designs: Repository<Design>,
    @InjectRepository(Competency) private competencies: Repository<Competency>,
    @InjectRepository(Simulation) private simulations: Repository<Simulation>,
    @InjectRepository(AssessmentDesign) private adesigns: Repository<AssessmentDesign>,
    @InjectRepository(AssessmentDesignDetailCompetency)
    private detailComp: Repository<AssessmentDesignDetailCompetency>,
    @InjectRepository(AssessmentDesignDetailSimulation)
    private detailSim: Repository<AssessmentDesignDetailSimulation>,
  ) {}

  // ================= LEVEL =================
  levelList(q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.levels.createQueryBuilder('l').where('l.is_deleted = false');
    applySearch(qb, 'l', ['level_id', 'level_name'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('l.created_date', 'DESC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  levelOptions() {
    return this.levels.find({ where: { is_deleted: false }, order: { level_id: 'ASC' } });
  }
  async levelCreate(dto: CreateLevelDto) {
    if (await this.levels.findOne({ where: { level_id: dto.level_id } }))
      throw new ConflictException('level_id sudah dipakai');
    return this.levels.save(this.levels.create({ ...dto, created_by: 'admin' }));
  }
  async levelUpdate(id: string, dto: UpdateLevelDto) {
    await this.levels.update({ level_id: id }, { ...dto, modified_by: 'admin' } as any);
    return this.levels.findOneOrFail({ where: { level_id: id } });
  }
  async levelRemove(id: string) {
    await this.levels.update({ level_id: id }, { is_deleted: true } as any);
    return { ok: true };
  }

  // ================= DESIGN =================
  designList(q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.designs.createQueryBuilder('d').where('d.is_deleted = false');
    applySearch(qb, 'd', ['design_id', 'design_name'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('d.created_date', 'DESC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  designOptions() {
    return this.designs.find({ where: { is_deleted: false }, order: { design_id: 'ASC' } });
  }
  async designCreate(dto: CreateDesignDto) {
    if (await this.designs.findOne({ where: { design_id: dto.design_id } }))
      throw new ConflictException('design_id sudah dipakai');
    return this.designs.save(this.designs.create({ ...dto, created_by: 'admin' }));
  }
  async designUpdate(id: string, dto: UpdateDesignDto) {
    await this.designs.update({ design_id: id }, { ...dto, modified_by: 'admin' } as any);
    return this.designs.findOneOrFail({ where: { design_id: id } });
  }
  async designRemove(id: string) {
    await this.designs.update({ design_id: id }, { is_deleted: true } as any);
    return { ok: true };
  }

  // ================= COMPETENCY =================
  competencyList(q: CompetencyQueryDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.competencies
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.level', 'lvl')
      .where('c.is_deleted = false');
    if (q.level_id) qb.andWhere('c.level_id = :lv', { lv: q.level_id });
    applySearch(qb, 'c', ['competency_id', 'competency_name', 'competency_desc'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('c.created_date', 'DESC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  async competencyCreate(dto: CreateCompetencyDto) {
    if (await this.competencies.findOne({ where: { competency_id: dto.competency_id } }))
      throw new ConflictException('competency_id sudah dipakai');
    return this.competencies.save(this.competencies.create({ ...dto, created_by: 'admin' }));
  }
  async competencyUpdate(id: string, dto: UpdateCompetencyDto) {
    await this.competencies.update({ competency_id: id }, { ...dto, modified_by: 'admin' } as any);
    return this.competencies.findOneOrFail({ where: { competency_id: id } });
  }
  async competencyRemove(id: string) {
    await this.competencies.update({ competency_id: id }, { is_deleted: true } as any);
    return { ok: true };
  }
  // Picker Add Competency: yang belum ditempel ke design ini
  async competencyAvailable(designId: string, q: PaginationDto) {
    const attached = await this.detailComp.find({
      where: { assessment_design_id: designId, is_deleted: false },
      select: ['competency_id'],
    });
    const skipIds = attached.map((a) => a.competency_id);
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.competencies
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.level', 'lvl')
      .where('c.is_deleted = false');
    if (skipIds.length) qb.andWhere('c.competency_id NOT IN (:...ids)', { ids: skipIds });
    applySearch(qb, 'c', ['competency_id', 'competency_name', 'competency_desc'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('c.competency_id', 'ASC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }

  // ================= SIMULATION (kolom ERD + level_id FK master_level) =================
  simulationList(q: SimulationQueryDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.simulations
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.level', 'lvl')
      .where('s.is_deleted = false');
    const g = q.group_simulation_id || q.group_simulation;
    if (g)
      qb.andWhere('s.group_simulation_id = :g', { g });
    if (q.level_id)
      qb.andWhere('s.level_id = :lv', { lv: q.level_id });
    applySearch(qb, 's', ['simulation_id', 'simulation_name', 'simulation_desc', 'group_simulation_id', 'channel_name'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('s.simulation_id', 'ASC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  simulationGroups() {
    return this.simulations
      .createQueryBuilder('s')
      .select('DISTINCT s.group_simulation_id', 'group_simulation_id')
      .where('s.is_deleted = false AND s.group_simulation_id IS NOT NULL')
      .getRawMany();
  }
  async simulationCreate(dto: CreateSimulationDto) {
    if (await this.simulations.findOne({ where: { simulation_id: dto.simulation_id } }))
      throw new ConflictException('simulation_id sudah dipakai');
    return this.simulations.save(this.simulations.create({ ...dto, created_by: 'admin' }));
  }
  async simulationUpdate(id: string, dto: UpdateSimulationDto) {
    await this.simulations.update({ simulation_id: id }, { ...dto, modified_by: 'admin' } as any);
    return this.simulations.findOneOrFail({ where: { simulation_id: id } });
  }
  async simulationRemove(id: string) {
    await this.simulations.update({ simulation_id: id }, { is_deleted: true } as any);
    return { ok: true };
  }
  async simulationAvailable(designId: string, q: SimulationQueryDto) {
    const attached = await this.detailSim.find({
      where: { assessment_design_id: designId, is_deleted: false },
      select: ['simulation_id'],
    });
    const skipIds = attached.map((a) => a.simulation_id);
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.simulations.createQueryBuilder('s').leftJoinAndSelect('s.level', 'lvl').where('s.is_deleted = false');
    if (skipIds.length) qb.andWhere('s.simulation_id NOT IN (:...ids)', { ids: skipIds });
    const g = q.group_simulation_id || q.group_simulation;
    if (g)
      qb.andWhere('s.group_simulation_id = :g', { g });
    if (q.level_id)
      qb.andWhere('s.level_id = :lv', { lv: q.level_id });
    applySearch(qb, 's', ['simulation_id', 'simulation_name', 'simulation_desc'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('s.simulation_id', 'ASC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }

  // ================= ASSESSMENT DESIGN =================
  async adesignList(q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 10;
    const qb = this.adesigns
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.level', 'lvl')
      .leftJoinAndSelect('a.design', 'dsg')
      .where('a.is_deleted = false');
    applySearch(qb, 'a', ['assessment_design_id', 'assessment_design_name'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('a.created_date', 'DESC');
    const [rows, total] = await qb.getManyAndCount();
    // hitung competency & simulation per design (sesuai kolom Lofi)
    const out = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        competency_count: await this.detailComp.count({
          where: { assessment_design_id: r.assessment_design_id, is_deleted: false },
        }),
        simulation_count: await this.detailSim.count({
          where: { assessment_design_id: r.assessment_design_id, is_deleted: false },
        }),
      })),
    );
    return paginateResponse(out, total, page, limit);
  }
  adesignOne(id: string) {
    return this.adesigns.findOneOrFail({
      where: { assessment_design_id: id, is_deleted: false },
      relations: ['level', 'design'],
    });
  }
  async adesignCreate(dto: CreateAssessmentDesignDto) {
    if (await this.adesigns.findOne({ where: { assessment_design_id: dto.assessment_design_id } }))
      throw new ConflictException('assessment_design_id sudah dipakai');
    return this.adesigns.save(this.adesigns.create({ ...dto, created_by: 'admin' }));
  }
  async adesignUpdate(id: string, dto: UpdateAssessmentDesignDto) {
    const cur = await this.adesigns.findOne({ where: { assessment_design_id: id } });
    if (!cur) throw new NotFoundException('Design tidak ditemukan');
    await this.adesigns.update({ assessment_design_id: id }, { ...dto, modified_by: 'admin' } as any);
    return this.adesignOne(id);
  }
  async adesignRemove(id: string) {
    await this.adesigns.update({ assessment_design_id: id }, { is_deleted: true } as any);
    return { ok: true };
  }

  // ---- detail competency ----
  detailCompList(designId: string, q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 50;
    const qb = this.detailComp
      .createQueryBuilder('dc')
      .leftJoinAndSelect('dc.competency', 'c')
      .leftJoinAndSelect('c.level', 'lvl')
      .where('dc.is_deleted = false AND dc.assessment_design_id = :id', { id: designId });
    applySearch(qb, 'c', ['competency_id', 'competency_name', 'competency_desc'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('dc.created_date', 'ASC');
    return qb.getManyAndCount().then(([data, total]) => paginateResponse(data, total, page, limit));
  }
  async detailCompAdd(designId: string, dto: AddCompetencyToDesignDto) {
    const exist = await this.detailComp.findOne({
      where: { assessment_design_id: designId, competency_id: dto.competency_id, is_deleted: false },
    });
    if (exist) throw new ConflictException('Competency sudah ada di design ini');
    const detId = `${designId}_${dto.competency_id}`;
    const softDeleted = await this.detailComp.findOne({ where: { assessment_design_detail_competency_id: detId } });
    if (softDeleted) {
      softDeleted.is_deleted = false;
      return this.detailComp.save(softDeleted);
    }
    return this.detailComp.save(
      this.detailComp.create({
        assessment_design_detail_competency_id: detId,
        assessment_design_id: designId,
        competency_id: dto.competency_id,
        created_by: 'admin',
      }),
    );
  }
  async detailCompRemove(designId: string, detailId: string) {
    await this.detailComp.update(
      { assessment_design_detail_competency_id: detailId, assessment_design_id: designId },
      { is_deleted: true } as any,
    );
    return { ok: true };
  }

  // ---- detail simulation ----
  detailSimList(designId: string, q: PaginationDto) {
    const page = q.page ?? 1, limit = q.limit ?? 50;
    const qb = this.detailSim
      .createQueryBuilder('ds')
      .leftJoinAndSelect('ds.simulation', 's')
      .leftJoinAndSelect('s.level', 'lvl')
      .where('ds.is_deleted = false AND ds.assessment_design_id = :id', { id: designId });
    applySearch(qb, 's', ['simulation_id', 'simulation_name', 'group_simulation_id'], q.search);
    qb.skip((page - 1) * limit).take(limit).orderBy('ds.sequence', 'ASC').addOrderBy('ds.created_date', 'ASC');
    return qb.getManyAndCount().then(async ([data, total]) => {
      const totalDuration = data.reduce((sum, d) => sum + (d.simulation?.duration ?? 0), 0);
      return { ...paginateResponse(data, total, page, limit), totalDuration };
    });
  }
  async detailSimAdd(designId: string, dto: AddSimulationToDesignDto) {
    const exist = await this.detailSim.findOne({
      where: { assessment_design_id: designId, simulation_id: dto.simulation_id, is_deleted: false },
    });
    if (exist) throw new ConflictException('Simulation sudah ada di design ini');
    const detId = `${designId}_${dto.simulation_id}`;
    const softDeleted = await this.detailSim.findOne({ where: { assessment_design_detail_simulation_id: detId } });
    const count = await this.detailSim.count({ where: { assessment_design_id: designId, is_deleted: false } });
    if (softDeleted) {
      softDeleted.is_deleted = false;
      softDeleted.sequence = dto.sequence ?? count + 1;
      return this.detailSim.save(softDeleted);
    }
    return this.detailSim.save(
      this.detailSim.create({
        assessment_design_detail_simulation_id: detId,
        assessment_design_id: designId,
        simulation_id: dto.simulation_id,
        sequence: dto.sequence ?? count + 1,
        created_by: 'admin',
      }),
    );
  }
  async detailSimRemove(designId: string, detailId: string) {
    await this.detailSim.update(
      { assessment_design_detail_simulation_id: detailId, assessment_design_id: designId },
      { is_deleted: true } as any,
    );
    return { ok: true };
  }
}
