import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { paginateResponse } from '../../common/dto/pagination.dto';
import {
  ActivityQueryDto,
  ActorQueryDto,
  ChatQueryDto,
  CreateActivityDto,
  CreateActorDto,
  CreateChatDto,
  CreateEmailDto,
  CreateScenarioActivityDto,
  EmailQueryDto,
  ScenarioActivityQueryDto,
  UpdateActivityDto,
  UpdateActorDto,
  UpdateChatDto,
  UpdateEmailDto,
  UpdateScenarioActivityDto,
} from './dto';
import {
  Activity,
  ActivityType,
  Actor,
  Chat,
  Email,
  Prompt,
  ScenarioActivity,
} from './entities';

function applySearch(qb: any, alias: string, cols: string[], search?: string) {
  if (!search) return;
  qb.andWhere(
    new Brackets((sqb: any) => {
      cols.forEach((c, i) => {
        // kolom boleh memakai alias lain (mis. "act.activity_name")
        const cond = c.includes('.') ? `${c} LIKE :s` : `${alias}.${c} LIKE :s`;
        if (i === 0) sqb.where(cond, { s: `%${search}%` });
        else sqb.orWhere(cond, { s: `%${search}%` });
      });
    }),
  );
}

/**
 * Normalisasi payload: dropdown yang tidak dipilih mengirim '' — untuk kolom FK
 * harus jadi NULL, kalau tidak MySQL menolak foreign key.
 */
function clean(dto: Record<string, any>, fkFields: string[], skip: string[] = []) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v === undefined || skip.includes(k)) continue;
    out[k] = fkFields.includes(k) && v === '' ? null : v;
  }
  return out;
}

@Injectable()
export class AssessmentDataService {
  constructor(
    @InjectRepository(Activity) private activities: Repository<Activity>,
    @InjectRepository(ScenarioActivity) private scenarios: Repository<ScenarioActivity>,
    @InjectRepository(Chat) private chats: Repository<Chat>,
    @InjectRepository(Email) private emails: Repository<Email>,
    @InjectRepository(Actor) private actors: Repository<Actor>,
    @InjectRepository(Prompt) private prompts: Repository<Prompt>,
    @InjectRepository(ActivityType) private activityTypes: Repository<ActivityType>,
  ) {}

  // ================= MASTER ACTIVITY =================
  activityList(q: ActivityQueryDto) {
    const page = q.page ?? 1,
      limit = q.limit ?? 10;
    const qb = this.activities
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.level', 'lvl')
      .leftJoinAndSelect('a.design', 'dsg')
      .leftJoinAndSelect('a.simulation', 'sim')
      .leftJoinAndSelect('a.activityType', 'atp')
      .where('a.is_deleted = false');
    if (q.level_id) qb.andWhere('a.level_id = :lv', { lv: q.level_id });
    if (q.design_id) qb.andWhere('a.design_id = :dg', { dg: q.design_id });
    if (q.simulation_id) qb.andWhere('a.simulation_id = :sm', { sm: q.simulation_id });
    if (q.ref_activity_type_id)
      qb.andWhere('a.ref_activity_type_id = :at', { at: q.ref_activity_type_id });
    applySearch(qb, 'a', ['activity_id', 'activity_name', 'activity_desc', 'state_name'], q.search);
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('a.activity_name', 'ASC');
    return qb.getManyAndCount().then(([d, t]) => paginateResponse(d, t, page, limit));
  }

  activityOptions() {
    return this.activities.find({ where: { is_deleted: false }, order: { activity_name: 'ASC' } });
  }

  async activityOne(id: string) {
    const row = await this.activities.findOne({
      where: { activity_id: id, is_deleted: false },
      relations: ['level', 'design', 'simulation', 'activityType'],
    });
    if (!row) throw new NotFoundException(`Activity ${id} tidak ditemukan`);
    return row;
  }

  async activityCreate(dto: CreateActivityDto) {
    const exist = await this.activities.findOne({ where: { activity_id: dto.activity_id } });
    if (exist && !exist.is_deleted) throw new ConflictException('activity_id sudah dipakai');
    const data = clean(dto, ['level_id', 'design_id', 'simulation_id', 'ref_activity_type_id'], [
      'activity_id',
    ]);
    if (exist) {
      await this.activities.update({ activity_id: dto.activity_id }, { ...data, is_deleted: false, modified_by: 'admin' });
    } else {
      await this.activities.save(
        this.activities.create({ ...data, activity_id: dto.activity_id, created_by: 'admin' }),
      );
    }
    return this.activityOne(dto.activity_id);
  }

  async activityUpdate(id: string, dto: UpdateActivityDto) {
    await this.activityOne(id);
    const data = clean(dto, ['level_id', 'design_id', 'simulation_id', 'ref_activity_type_id']);
    if (Object.keys(data).length) {
      await this.activities.update({ activity_id: id }, { ...data, modified_by: 'admin' } as any);
    }
    return this.activityOne(id);
  }

  async activityRemove(id: string) {
    const r = await this.activities.update({ activity_id: id, is_deleted: false }, { is_deleted: true } as any);
    if (!r.affected) throw new NotFoundException(`Activity ${id} tidak ditemukan`);
    return { ok: true };
  }

  // ================= MASTER SCENARIO ACTIVITY =================
  scenarioList(q: ScenarioActivityQueryDto) {
    const page = q.page ?? 1,
      limit = q.limit ?? 10;
    const qb = this.scenarios
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.activity', 'act')
      .leftJoinAndSelect('s.triggeredActivity', 'tact')
      .leftJoinAndSelect('s.actor', 'ac')
      .leftJoinAndSelect('s.targetActor', 'tac')
      .leftJoinAndSelect('s.prompt', 'pr')
      .leftJoinAndSelect('s.targetActivityType', 'tat')
      .where('s.is_deleted = false');
    if (q.activity_id) qb.andWhere('s.activity_id = :ac', { ac: q.activity_id });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.actor_id) qb.andWhere('s.actor_id = :ar', { ar: q.actor_id });
    applySearch(qb, 's', ['scenario_activity_id', 'status', 'need_reply', 'act.activity_name'], q.search);
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('s.created_date', 'DESC');
    return qb.getManyAndCount().then(([d, t]) => paginateResponse(d, t, page, limit));
  }

  async scenarioOne(id: string) {
    const row = await this.scenarios.findOne({
      where: { scenario_activity_id: id, is_deleted: false },
      relations: ['activity', 'triggeredActivity', 'actor', 'targetActor', 'prompt', 'targetActivityType'],
    });
    if (!row) throw new NotFoundException(`Scenario activity ${id} tidak ditemukan`);
    return row;
  }

  private scenarioFk() {
    return ['activity_id', 'triggered_activity_id', 'actor_id', 'prompt_id', 'target_actor_id', 'document_id', 'target_activity_type'];
  }

  async scenarioCreate(dto: CreateScenarioActivityDto) {
    const exist = await this.scenarios.findOne({
      where: { scenario_activity_id: dto.scenario_activity_id },
    });
    if (exist && !exist.is_deleted)
      throw new ConflictException('scenario_activity_id sudah dipakai');
    const data = clean(dto, this.scenarioFk(), ['scenario_activity_id']);
    if (exist) {
      await this.scenarios.update(
        { scenario_activity_id: dto.scenario_activity_id },
        { ...data, is_deleted: false, modified_by: 'admin' },
      );
    } else {
      await this.scenarios.save(
        this.scenarios.create({
          ...data,
          scenario_activity_id: dto.scenario_activity_id,
          created_by: 'admin',
        }),
      );
    }
    return this.scenarioOne(dto.scenario_activity_id);
  }

  async scenarioUpdate(id: string, dto: UpdateScenarioActivityDto) {
    await this.scenarioOne(id);
    const data = clean(dto, this.scenarioFk());
    if (Object.keys(data).length) {
      await this.scenarios.update({ scenario_activity_id: id }, { ...data, modified_by: 'admin' } as any);
    }
    return this.scenarioOne(id);
  }

  async scenarioRemove(id: string) {
    const r = await this.scenarios.update(
      { scenario_activity_id: id, is_deleted: false },
      { is_deleted: true } as any,
    );
    if (!r.affected) throw new NotFoundException(`Scenario activity ${id} tidak ditemukan`);
    return { ok: true };
  }

  // ================= MASTER CHAT =================
  chatList(q: ChatQueryDto) {
    const page = q.page ?? 1,
      limit = q.limit ?? 10;
    const qb = this.chats
      .createQueryBuilder('ch')
      .leftJoinAndSelect('ch.activity', 'act')
      .leftJoinAndSelect('ch.actor', 'ac')
      .where('ch.is_deleted = false');
    if (q.activity_id) qb.andWhere('ch.activity_id = :ac', { ac: q.activity_id });
    if (q.actor_id) qb.andWhere('ch.actor_id = :ar', { ar: q.actor_id });
    applySearch(qb, 'ch', ['chat_id', 'chat_name', 'content', 'act.activity_name'], q.search);
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('ch.created_date', 'DESC');
    return qb.getManyAndCount().then(([d, t]) => paginateResponse(d, t, page, limit));
  }

  async chatOne(id: string) {
    const row = await this.chats.findOne({
      where: { chat_id: id, is_deleted: false },
      relations: ['activity', 'actor'],
    });
    if (!row) throw new NotFoundException(`Chat ${id} tidak ditemukan`);
    return row;
  }

  async chatCreate(dto: CreateChatDto) {
    const exist = await this.chats.findOne({ where: { chat_id: dto.chat_id } });
    if (exist && !exist.is_deleted) throw new ConflictException('chat_id sudah dipakai');
    const data = clean(dto, ['activity_id', 'actor_id'], ['chat_id']);
    if (exist) {
      await this.chats.update({ chat_id: dto.chat_id }, { ...data, is_deleted: false, modified_by: 'admin' });
    } else {
      await this.chats.save(this.chats.create({ ...data, chat_id: dto.chat_id, created_by: 'admin' }));
    }
    return this.chatOne(dto.chat_id);
  }

  async chatUpdate(id: string, dto: UpdateChatDto) {
    await this.chatOne(id);
    const data = clean(dto, ['activity_id', 'actor_id']);
    if (Object.keys(data).length) {
      await this.chats.update({ chat_id: id }, { ...data, modified_by: 'admin' } as any);
    }
    return this.chatOne(id);
  }

  async chatRemove(id: string) {
    const r = await this.chats.update({ chat_id: id, is_deleted: false }, { is_deleted: true } as any);
    if (!r.affected) throw new NotFoundException(`Chat ${id} tidak ditemukan`);
    return { ok: true };
  }

  // ================= MASTER EMAIL =================
  emailList(q: EmailQueryDto) {
    const page = q.page ?? 1,
      limit = q.limit ?? 10;
    const qb = this.emails
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.activity', 'act')
      .leftJoinAndSelect('e.parentActivity', 'pact')
      .leftJoinAndSelect('e.actorFrom', 'af')
      .leftJoinAndSelect('e.actorTo', 'at')
      .leftJoinAndSelect('e.actorCc', 'acc')
      .where('e.is_deleted = false');
    if (q.activity_id) qb.andWhere('e.activity_id = :ac', { ac: q.activity_id });
    if (q.email_type) qb.andWhere('e.email_type = :et', { et: q.email_type });
    applySearch(qb, 'e', ['email_id', 'email_name', 'subject', 'content', 'email_type', 'act.activity_name'], q.search);
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('e.created_date', 'DESC');
    return qb.getManyAndCount().then(([d, t]) => paginateResponse(d, t, page, limit));
  }

  async emailOne(id: string) {
    const row = await this.emails.findOne({
      where: { email_id: id, is_deleted: false },
      relations: ['activity', 'parentActivity', 'actorFrom', 'actorTo', 'actorCc'],
    });
    if (!row) throw new NotFoundException(`Email ${id} tidak ditemukan`);
    return row;
  }

  async emailCreate(dto: CreateEmailDto) {
    const exist = await this.emails.findOne({ where: { email_id: dto.email_id } });
    if (exist && !exist.is_deleted) throw new ConflictException('email_id sudah dipakai');
    const data = clean(dto, ['activity_id', 'parent_activity_id', 'actor_from', 'actor_to', 'actor_cc'], [
      'email_id',
    ]);
    if (exist) {
      await this.emails.update({ email_id: dto.email_id }, { ...data, is_deleted: false, modified_by: 'admin' });
    } else {
      await this.emails.save(this.emails.create({ ...data, email_id: dto.email_id, created_by: 'admin' }));
    }
    return this.emailOne(dto.email_id);
  }

  async emailUpdate(id: string, dto: UpdateEmailDto) {
    await this.emailOne(id);
    const data = clean(dto, ['activity_id', 'parent_activity_id', 'actor_from', 'actor_to', 'actor_cc']);
    if (Object.keys(data).length) {
      await this.emails.update({ email_id: id }, { ...data, modified_by: 'admin' } as any);
    }
    return this.emailOne(id);
  }

  async emailRemove(id: string) {
    const r = await this.emails.update({ email_id: id, is_deleted: false }, { is_deleted: true } as any);
    if (!r.affected) throw new NotFoundException(`Email ${id} tidak ditemukan`);
    return { ok: true };
  }

  // ================= MASTER ACTOR =================
  actorList(q: ActorQueryDto) {
    const page = q.page ?? 1,
      limit = q.limit ?? 10;
    const qb = this.actors
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.design', 'dsg')
      .leftJoinAndSelect('ac.level', 'lvl')
      .leftJoinAndSelect('ac.superiorActor', 'sup')
      .where('ac.is_deleted = false');
    if (q.design_id) qb.andWhere('ac.design_id = :dg', { dg: q.design_id });
    if (q.level_id) qb.andWhere('ac.level_id = :lv', { lv: q.level_id });
    applySearch(
      qb,
      'ac',
      ['actor_id', 'actor_name', 'actor_email', 'actor_position', 'actor_group_position'],
      q.search,
    );
    qb.skip((page - 1) * limit)
      .take(limit)
      .orderBy('ac.actor_name', 'ASC');
    return qb.getManyAndCount().then(([d, t]) => paginateResponse(d, t, page, limit));
  }

  async actorOne(id: string) {
    const row = await this.actors.findOne({
      where: { actor_id: id, is_deleted: false },
      relations: ['design', 'level', 'superiorActor'],
    });
    if (!row) throw new NotFoundException(`Actor ${id} tidak ditemukan`);
    return row;
  }

  async actorCreate(dto: CreateActorDto) {
    const exist = await this.actors.findOne({ where: { actor_id: dto.actor_id } });
    if (exist && !exist.is_deleted) throw new ConflictException('actor_id sudah dipakai');
    const data = clean(dto, ['superior', 'design_id', 'level_id'], ['actor_id']);
    if (exist) {
      await this.actors.update({ actor_id: dto.actor_id }, { ...data, is_deleted: false, modified_by: 'admin' });
    } else {
      await this.actors.save(
        this.actors.create({ ...data, actor_id: dto.actor_id, created_by: 'admin' } as any),
      );
    }
    return this.actorOne(dto.actor_id);
  }

  async actorUpdate(id: string, dto: UpdateActorDto) {
    await this.actorOne(id);
    const data = clean(dto, ['superior', 'design_id', 'level_id']);
    if (data.superior === id) data.superior = null; // jangan jadi atasan diri sendiri
    if (Object.keys(data).length) {
      await this.actors.update({ actor_id: id }, { ...data, modified_by: 'admin' } as any);
    }
    return this.actorOne(id);
  }

  async actorRemove(id: string) {
    const r = await this.actors.update({ actor_id: id, is_deleted: false }, { is_deleted: true } as any);
    if (!r.affected) throw new NotFoundException(`Actor ${id} tidak ditemukan`);
    return { ok: true };
  }

  // ================= OPTIONS (untuk dropdown) =================
  actorOptions() {
    return this.actors.find({ where: { is_deleted: false }, order: { actor_name: 'ASC' } });
  }

  promptOptions() {
    return this.prompts.find({ where: { is_deleted: false }, order: { prompt_id: 'ASC' } });
  }

  activityTypeOptions() {
    return this.activityTypes.find({
      where: { is_deleted: false },
      order: { ref_activity_type_name: 'ASC' },
    });
  }
}
