import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  Activity,
  Actor,
  Call,
  Chat,
  Email,
  EmailAttachment,
  Folder,
  MappingGroupRating,
  ScenarioActivity,
} from '../assessment-data/entities';
import { MasterDocument, MasterDocumentContent } from '../documents/document.entity';
import {
  AssessmentDesign,
  AssessmentDesignDetailCompetency,
  AssessmentDesignDetailSimulation,
  Design,
} from './entities';

export type CopySummary = {
  source_assessment_design_id: string;
  assessment_design_id: string;
  assessment_design_name: string;
  design_id: string | null;
  design_name: string | null;
  counts: Record<string, number>;
};

const MAX_LEN = 50;
const COPY_SUFFIX = '-COPY';

function clamp(value: string, max = MAX_LEN): string {
  return value.length <= max ? value : value.slice(0, max);
}

/** ID unik: pakai `base`; jika sudah dipakai tambahkan -2, -3, dst (tetap <= 50 char). */
function uniqueId(base: string, used: Set<string>): string {
  let candidate = clamp(base);
  let n = 2;
  while (used.has(candidate)) {
    const suffix = `-${n}`;
    candidate = clamp(`${base.slice(0, Math.max(1, MAX_LEN - suffix.length))}${suffix}`);
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/** ID untuk baris hasil copy: `<id lama>-COPY`, lalu `-COPY2`, ... bila sudah ada. */
function copyId(base: string, used: Set<string>): string {
  const head = `${clamp(base, MAX_LEN - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
  if (!used.has(head)) {
    used.add(head);
    return head;
  }
  let n = 2;
  for (;;) {
    const suffix = `-COPY${n}`;
    const candidate = clamp(`${base.slice(0, Math.max(1, MAX_LEN - suffix.length))}${suffix}`);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    n += 1;
  }
}

function copyLabel(sourceId: string, newId: string): string {
  const tail = newId.slice(sourceId.length);
  const match = /-COPY-?(\d+)$/.exec(tail);
  return match && Number(match[1]) > 1 ? ` (Copy ${match[1]})` : ' (Copy)';
}

function withCopyName(name: string, sourceId: string, newId: string, max: number): string {
  const label = copyLabel(sourceId, newId);
  // jangan menumpuk label bila sumbernya sudah hasil copy
  const base = name.replace(/ \(Copy(?: \d+)?\)$/i, '');
  return `${base.slice(0, Math.max(0, max - label.length))}${label}`;
}

async function existingIds(manager: EntityManager, entity: any, pk: string): Promise<Set<string>> {
  const rows = await manager
    .getRepository(entity)
    .createQueryBuilder('t')
    .select(`t.${pk}`, pk)
    .getRawMany<Record<string, string>>();
  return new Set(rows.map((r) => String(r[pk])));
}

/**
 * Copy (deep clone) satu assessment design:
 * master_assessment_design + detail competency/simulation, lalu seluruh data turunan
 * design-nya: folder, actor, activity, dokumen + konten, scenario, chat, call, email
 * (+attachment), dan mapping group rating.
 *
 * master_design ikut digandakan (ID baru) supaya hasil copy terisolasi dari design asal.
 * Activity yang diambil hanya yang simulation_id-nya ada di detail simulation assessment
 * design sumber (plus activity tanpa simulation, mis. HOME/latar belakang).
 *
 * Semua penulisan dalam satu transaksi; gagal di tengah = tidak ada data setengah jadi.
 */
@Injectable()
export class AssessmentCopyService {
  constructor(private readonly dataSource: DataSource) {}

  copy(sourceId: string, username = 'admin'): Promise<CopySummary> {
    return this.dataSource.transaction(async (manager) => {
      const adRepo = manager.getRepository(AssessmentDesign);
      const designRepo = manager.getRepository(Design);
      const dcRepo = manager.getRepository(AssessmentDesignDetailCompetency);
      const dsRepo = manager.getRepository(AssessmentDesignDetailSimulation);
      const folderRepo = manager.getRepository(Folder);
      const actorRepo = manager.getRepository(Actor);
      const activityRepo = manager.getRepository(Activity);
      const docRepo = manager.getRepository(MasterDocument);
      const contentRepo = manager.getRepository(MasterDocumentContent);
      const scenarioRepo = manager.getRepository(ScenarioActivity);
      const chatRepo = manager.getRepository(Chat);
      const callRepo = manager.getRepository(Call);
      const emailRepo = manager.getRepository(Email);
      const attachmentRepo = manager.getRepository(EmailAttachment);
      const mappingRepo = manager.getRepository(MappingGroupRating);

      const source = await adRepo.findOne({
        where: { assessment_design_id: sourceId, is_deleted: false },
      });
      if (!source) throw new NotFoundException(`Assessment design ${sourceId} tidak ditemukan`);

      const sourceDesign = source.design_id
        ? await designRepo.findOne({ where: { design_id: source.design_id, is_deleted: false } })
        : null;
      if (source.design_id && !sourceDesign) {
        throw new BadRequestException(
          `Design ${source.design_id} milik assessment design ini tidak ditemukan`,
        );
      }

      // ---------- kumpulkan data sumber ----------
      const sourceDetailComps = await dcRepo.find({
        where: { assessment_design_id: sourceId, is_deleted: false },
        order: { created_date: 'ASC' },
      });
      const sourceDetailSims = await dsRepo.find({
        where: { assessment_design_id: sourceId, is_deleted: false },
        order: { sequence: 'ASC' },
      });
      const simulationIds = [...new Set(sourceDetailSims.map((r) => r.simulation_id))];

      const levelFilter = source.level_id ? source.level_id : null;
      const activityWhere = sourceDesign
        ? {
            design_id: sourceDesign.design_id,
            is_deleted: false,
            ...(levelFilter ? { level_id: levelFilter } : {}),
          }
        : null;

      let sourceActivities: Activity[] = [];
      if (activityWhere) {
        const all = await activityRepo.find({ where: activityWhere as any });
        sourceActivities = all.filter(
          (a) => a.simulation_id === null || simulationIds.includes(a.simulation_id),
        );
      }
      const activityIds = sourceActivities.map((a) => a.activity_id);
      const hasActivities = activityIds.length > 0;

      const sourceScenarios = hasActivities
        ? await scenarioRepo.find({ where: { activity_id: In(activityIds), is_deleted: false } })
        : [];
      const sourceChats = hasActivities
        ? await chatRepo.find({ where: { activity_id: In(activityIds), is_deleted: false } })
        : [];
      const sourceCalls = hasActivities
        ? await callRepo.find({ where: { activity_id: In(activityIds), is_deleted: false } })
        : [];
      const sourceEmails = hasActivities
        ? await emailRepo.find({ where: { activity_id: In(activityIds), is_deleted: false } })
        : [];
      const emailIds = sourceEmails.map((e) => e.email_id);

      const sourceAttachments = emailIds.length
        ? await attachmentRepo.find({ where: { email_id: In(emailIds), is_deleted: false } })
        : [];
      const attachmentContentIds = [
        ...new Set(sourceAttachments.map((a) => a.doc_content_id).filter(Boolean)),
      ] as string[];

      const attachmentContents = attachmentContentIds.length
        ? await contentRepo.find({
            where: { document_content_id: In(attachmentContentIds), is_deleted: false },
          })
        : [];
      const attachmentDocumentIds = [...new Set(attachmentContents.map((c) => c.document_id))];
      const scenarioDocumentIds = [
        ...new Set(sourceScenarios.map((s) => s.document_id).filter(Boolean)),
      ] as string[];

      const documentFilters: any[] = [];
      if (hasActivities) documentFilters.push({ activity_id: In(activityIds) });
      if (scenarioDocumentIds.length) documentFilters.push({ document_id: In(scenarioDocumentIds) });
      if (attachmentDocumentIds.length)
        documentFilters.push({ document_id: In(attachmentDocumentIds) });

      let sourceDocuments: MasterDocument[] = [];
      if (sourceDesign && documentFilters.length) {
        const seen = new Set<string>();
        for (const filter of documentFilters) {
          const rows = await docRepo.find({ where: { ...filter, is_deleted: false } });
          for (const row of rows) {
            if (!seen.has(row.document_id)) {
              seen.add(row.document_id);
              sourceDocuments.push(row);
            }
          }
        }
      }
      const documentIds = sourceDocuments.map((d) => d.document_id);
      const sourceContents = documentIds.length
        ? await contentRepo.find({
            where: { document_id: In(documentIds), is_deleted: false },
            order: { page: 'ASC' },
          })
        : [];

      // ---------- folder (design + level; ikut yang dipakai dokumen) ----------
      let sourceFolders: Folder[] = [];
      if (sourceDesign) {
        const folderSet = new Set<string>();
        const baseFolders = await folderRepo.find({
          where: {
            design_id: sourceDesign.design_id,
            is_deleted: false,
            ...(levelFilter ? { level_id: levelFilter } : {}),
          } as any,
        });
        for (const f of baseFolders) {
          folderSet.add(f.folder_id);
          sourceFolders.push(f);
        }
        const docFolderIds = [
          ...new Set(sourceDocuments.map((d) => d.folder_id).filter(Boolean)),
        ] as string[];
        const missingFolderIds = docFolderIds.filter((id) => !folderSet.has(id));
        if (missingFolderIds.length) {
          const extra = await folderRepo.find({
            where: { folder_id: In(missingFolderIds), is_deleted: false },
          });
          for (const f of extra) {
            if (!folderSet.has(f.folder_id)) {
              folderSet.add(f.folder_id);
              sourceFolders.push(f);
            }
          }
        }
      }

      // ---------- actor (design + level, referenced, dan atasan berantai) ----------
      let sourceActors: Actor[] = [];
      if (sourceDesign) {
        const actorSet = new Set<string>();
        const baseActors = await actorRepo.find({
          where: {
            design_id: sourceDesign.design_id,
            is_deleted: false,
            ...(levelFilter ? { level_id: levelFilter } : {}),
          } as any,
        });
        for (const a of baseActors) {
          actorSet.add(a.actor_id);
          sourceActors.push(a);
        }
        const referenced = new Set<string>();
        for (const s of sourceScenarios) {
          if (s.actor_id) referenced.add(s.actor_id);
          if (s.target_actor_id) referenced.add(s.target_actor_id);
        }
        for (const c of sourceChats) if (c.actor_id) referenced.add(c.actor_id);
        for (const c of sourceCalls) if (c.actor_id) referenced.add(c.actor_id);
        for (const e of sourceEmails) {
          if (e.actor_from) referenced.add(e.actor_from);
          if (e.actor_to) referenced.add(e.actor_to);
          if (e.actor_cc) referenced.add(e.actor_cc);
        }
        for (const d of sourceDocuments) if (d.owner) referenced.add(d.owner);
        for (const f of sourceFolders) if (f.owner) referenced.add(f.owner);

        const queue = [...referenced].filter((id) => !actorSet.has(id));
        while (queue.length) {
          const ids = queue.splice(0, queue.length);
          const rows = await actorRepo.find({ where: { actor_id: In(ids), is_deleted: false } });
          for (const a of rows) {
            if (actorSet.has(a.actor_id)) continue;
            actorSet.add(a.actor_id);
            sourceActors.push(a);
            if (a.superior && !actorSet.has(a.superior)) queue.push(a.superior);
          }
        }
        // atasan dari actor yang sudah masuk
        let pendingSuperiors = sourceActors
          .map((a) => a.superior)
          .filter((id): id is string => !!id && !actorSet.has(id));
        while (pendingSuperiors.length) {
          const rows = await actorRepo.find({
            where: { actor_id: In([...new Set(pendingSuperiors)]), is_deleted: false },
          });
          for (const a of rows) {
            if (!actorSet.has(a.actor_id)) {
              actorSet.add(a.actor_id);
              sourceActors.push(a);
            }
          }
          pendingSuperiors = rows
            .map((a) => a.superior)
            .filter((id): id is string => !!id && !actorSet.has(id));
        }
      }

      const sourceDetailSimIds = sourceDetailSims.map(
        (r) => r.assessment_design_detail_simulation_id,
      );
      const sourceMappings = sourceDetailSimIds.length
        ? await mappingRepo.find({
            where: { assessment_design_detail_simulation_id: In(sourceDetailSimIds), is_deleted: false },
          })
        : [];

      // ---------- set ID yang sudah dipakai ----------
      const used = {
        design: await existingIds(manager, Design, 'design_id'),
        ad: await existingIds(manager, AssessmentDesign, 'assessment_design_id'),
        detailComp: await existingIds(
          manager,
          AssessmentDesignDetailCompetency,
          'assessment_design_detail_competency_id',
        ),
        detailSim: await existingIds(
          manager,
          AssessmentDesignDetailSimulation,
          'assessment_design_detail_simulation_id',
        ),
        folder: await existingIds(manager, Folder, 'folder_id'),
        actor: await existingIds(manager, Actor, 'actor_id'),
        activity: await existingIds(manager, Activity, 'activity_id'),
        document: await existingIds(manager, MasterDocument, 'document_id'),
        scenario: await existingIds(manager, ScenarioActivity, 'scenario_activity_id'),
        chat: await existingIds(manager, Chat, 'chat_id'),
        call: await existingIds(manager, Call, 'call_id'),
        email: await existingIds(manager, Email, 'email_id'),
        attachment: await existingIds(manager, EmailAttachment, 'attachment_id'),
        mapping: await existingIds(manager, MappingGroupRating, 'mapping_group_rating_id'),
      };

      const counts: Record<string, number> = {};

      // ---------- 1. master_design ----------
      let newDesignId: string | null = null;
      let newDesignName: string | null = null;
      if (sourceDesign) {
        newDesignId = copyId(sourceDesign.design_id, used.design);
        newDesignName = withCopyName(
          sourceDesign.design_name,
          sourceDesign.design_id,
          newDesignId,
          100,
        );
        await designRepo.save(
          designRepo.create({
            design_id: newDesignId,
            design_name: newDesignName,
            design_desc: sourceDesign.design_desc ?? null,
            design_background: sourceDesign.design_background ?? null,
            design_background_md: sourceDesign.design_background_md ?? null,
            instruction: sourceDesign.instruction ?? null,
            instruction_md: sourceDesign.instruction_md ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
        counts.master_design = 1;
      }

      // ---------- 2. master_assessment_design ----------
      const newAdId = copyId(source.assessment_design_id, used.ad);
      const newAdName = withCopyName(
        source.assessment_design_name,
        source.assessment_design_id,
        newAdId,
        150,
      );
      await adRepo.save(
        adRepo.create({
          assessment_design_id: newAdId,
          assessment_design_name: newAdName,
          assessment_design_desc: source.assessment_design_desc ?? null,
          level_id: source.level_id ?? null,
          design_id: newDesignId,
          time_reminder: source.time_reminder ?? null,
          range_per_simulation: source.range_per_simulation ?? null,
          created_by: username,
          modified_by: username,
        }),
      );
      counts.master_assessment_design = 1;

      // ---------- 3. detail competency ----------
      for (const row of sourceDetailComps) {
        const newId = uniqueId(`${newAdId}_${row.competency_id}`, used.detailComp);
        await dcRepo.save(
          dcRepo.create({
            assessment_design_detail_competency_id: newId,
            assessment_design_id: newAdId,
            competency_id: row.competency_id,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_assessment_design_detail_competency = sourceDetailComps.length;

      // ---------- 4. detail simulation (ID dipakai lagi oleh mapping rating) ----------
      const detailSimMap = new Map<string, string>();
      for (const row of sourceDetailSims) {
        const newId = uniqueId(`${newAdId}_${row.simulation_id}`, used.detailSim);
        detailSimMap.set(row.assessment_design_detail_simulation_id, newId);
        await dsRepo.save(
          dsRepo.create({
            assessment_design_detail_simulation_id: newId,
            assessment_design_id: newAdId,
            simulation_id: row.simulation_id,
            sequence: row.sequence ?? 0,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_assessment_design_detail_simulation = sourceDetailSims.length;

      // ---------- 5. master_folder ----------
      const folderMap = new Map<string, string>();
      for (const row of sourceFolders) {
        const newId = copyId(row.folder_id, used.folder);
        folderMap.set(row.folder_id, newId);
        await folderRepo.save(
          folderRepo.create({
            folder_id: newId,
            folder_name: row.folder_name,
            assessment_design_id: row.assessment_design_id === sourceId ? newAdId : null,
            owner: row.owner ?? null,
            level_id: row.level_id ?? source.level_id ?? null,
            design_id: newDesignId,
            sort: row.sort ?? 0,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_folder = sourceFolders.length;

      // ---------- 6. master_actor (superior di-update setelah semua masuk) ----------
      const actorMap = new Map<string, string>();
      for (const row of sourceActors) {
        const newId = copyId(row.actor_id, used.actor);
        actorMap.set(row.actor_id, newId);
        await actorRepo.save(
          actorRepo.create({
            actor_id: newId,
            actor_name: row.actor_name,
            actor_email: row.actor_email ?? null,
            actor_position: row.actor_position ?? null,
            actor_division: row.actor_division ?? null,
            actor_group_position: row.actor_group_position ?? null,
            superior: null,
            design_id: newDesignId,
            level_id: row.level_id ?? source.level_id ?? null,
            persona_desc: row.persona_desc ?? null,
            is_participant: row.is_participant ?? false,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      for (const row of sourceActors) {
        if (!row.superior) continue;
        const newId = actorMap.get(row.actor_id);
        if (!newId) continue;
        const newSuperior = actorMap.get(row.superior) ?? row.superior;
        await actorRepo.update({ actor_id: newId }, { superior: newSuperior });
      }
      counts.master_actor = sourceActors.length;

      // owner folder menunjuk actor hasil copy (kolom tanpa FK, di-update setelah actor ada)
      for (const row of sourceFolders) {
        if (!row.owner) continue;
        const newOwner = actorMap.get(row.owner);
        const newFolderId = folderMap.get(row.folder_id);
        if (!newOwner || !newFolderId) continue;
        await folderRepo.update({ folder_id: newFolderId }, { owner: newOwner });
      }

      // ---------- 7. master_activity ----------
      const activityMap = new Map<string, string>();
      for (const row of sourceActivities) {
        const newId = copyId(row.activity_id, used.activity);
        activityMap.set(row.activity_id, newId);
        await activityRepo.save(
          activityRepo.create({
            activity_id: newId,
            activity_name: row.activity_name,
            activity_desc: row.activity_desc ?? null,
            level_id: row.level_id ?? source.level_id ?? null,
            design_id: newDesignId,
            simulation_id: row.simulation_id ?? null,
            ref_activity_type_id: row.ref_activity_type_id ?? null,
            state_name: row.state_name ?? null,
            is_first: row.is_first ?? false,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_activity = sourceActivities.length;

      // ---------- 8. master_document ----------
      const documentMap = new Map<string, string>();
      for (const row of sourceDocuments) {
        const newId = copyId(row.document_id, used.document);
        documentMap.set(row.document_id, newId);
        await docRepo.save(
          docRepo.create({
            document_id: newId,
            document_name: withCopyName(row.document_name, row.document_id, newId, 150),
            document_desc: row.document_desc ?? null,
            status: row.status,
            is_active: row.is_active,
            read_only: row.read_only ?? null,
            folder_id: row.folder_id ? folderMap.get(row.folder_id) ?? null : null,
            activity_id: row.activity_id ? activityMap.get(row.activity_id) ?? null : null,
            owner: row.owner ? actorMap.get(row.owner) ?? null : null,
            page_count: row.page_count,
            revision: 0,
            header_left: row.header_left,
            header_center: row.header_center,
            header_right: row.header_right,
            footer_left: row.footer_left,
            footer_center: row.footer_center,
            footer_right: row.footer_right,
            hide_header_footer_first_page: row.hide_header_footer_first_page,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_document = sourceDocuments.length;

      // ---------- 9. master_document_content ----------
      const contentMap = new Map<string, string>();
      for (const row of sourceContents) {
        const newDocumentId = documentMap.get(row.document_id);
        if (!newDocumentId) continue;
        const saved = await contentRepo.save(
          contentRepo.create({
            document_id: newDocumentId,
            page: row.page,
            content_html: row.content_html,
            document_content_md: row.document_content_md ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
        contentMap.set(row.document_content_id, saved.document_content_id);
      }
      counts.master_document_content = contentMap.size;

      // ---------- 10. master_scenario_activity ----------
      for (const row of sourceScenarios) {
        const newId = copyId(row.scenario_activity_id, used.scenario);
        await scenarioRepo.save(
          scenarioRepo.create({
            scenario_activity_id: newId,
            activity_id: activityMap.get(row.activity_id)!,
            triggered_activity_id: row.triggered_activity_id
              ? activityMap.get(row.triggered_activity_id) ?? null
              : null,
            timer: row.timer ?? null,
            status: row.status ?? null,
            actor_id: row.actor_id ? actorMap.get(row.actor_id) ?? null : null,
            prompt_id: row.prompt_id ?? null,
            target_actor_id: row.target_actor_id
              ? actorMap.get(row.target_actor_id) ?? null
              : null,
            need_reply: row.need_reply ?? null,
            document_id: row.document_id ? documentMap.get(row.document_id) ?? null : null,
            target_activity_type: row.target_activity_type ?? null,
            trigger_timer: row.trigger_timer ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_scenario_activity = sourceScenarios.length;

      // ---------- 11. master_chat ----------
      for (const row of sourceChats) {
        const newId = copyId(row.chat_id, used.chat);
        await chatRepo.save(
          chatRepo.create({
            chat_id: newId,
            chat_name: row.chat_name ?? null,
            activity_id: activityMap.get(row.activity_id!) ?? null,
            actor_id: row.actor_id ? actorMap.get(row.actor_id) ?? null : null,
            content: row.content ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_chat = sourceChats.length;

      // ---------- 12. master_call ----------
      for (const row of sourceCalls) {
        const newId = copyId(row.call_id, used.call);
        await callRepo.save(
          callRepo.create({
            call_id: newId,
            call_name: row.call_name ?? null,
            activity_id: activityMap.get(row.activity_id!) ?? null,
            actor_id: row.actor_id ? actorMap.get(row.actor_id) ?? null : null,
            content: row.content ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_call = sourceCalls.length;

      // ---------- 13. master_email ----------
      const emailMap = new Map<string, string>();
      for (const row of sourceEmails) {
        const newId = copyId(row.email_id, used.email);
        emailMap.set(row.email_id, newId);
        await emailRepo.save(
          emailRepo.create({
            email_id: newId,
            email_name: row.email_name ?? null,
            activity_id: activityMap.get(row.activity_id!) ?? null,
            parent_activity_id: row.parent_activity_id
              ? activityMap.get(row.parent_activity_id) ?? null
              : null,
            actor_from: row.actor_from ? actorMap.get(row.actor_from) ?? null : null,
            actor_to: row.actor_to ? actorMap.get(row.actor_to) ?? null : null,
            actor_cc: row.actor_cc ? actorMap.get(row.actor_cc) ?? null : null,
            email_type: row.email_type ?? null,
            subject: row.subject ?? null,
            content: row.content ?? null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_email = sourceEmails.length;

      // ---------- 14. master_email_attachment ----------
      for (const row of sourceAttachments) {
        const newId = copyId(row.attachment_id, used.attachment);
        await attachmentRepo.save(
          attachmentRepo.create({
            attachment_id: newId,
            email_id: emailMap.get(row.email_id)!,
            doc_content_id: row.doc_content_id
              ? contentMap.get(row.doc_content_id) ?? null
              : null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.master_email_attachment = sourceAttachments.length;

      // ---------- 15. ref_mapping_group_rating ----------
      for (const row of sourceMappings) {
        const newId = copyId(row.mapping_group_rating_id, used.mapping);
        await mappingRepo.save(
          mappingRepo.create({
            mapping_group_rating_id: newId,
            group_rating_id: row.group_rating_id ?? null,
            assessment_design_detail_simulation_id: row.assessment_design_detail_simulation_id
              ? detailSimMap.get(row.assessment_design_detail_simulation_id) ?? null
              : null,
            created_by: username,
            modified_by: username,
          }),
        );
      }
      counts.ref_mapping_group_rating = sourceMappings.length;

      return {
        source_assessment_design_id: sourceId,
        assessment_design_id: newAdId,
        assessment_design_name: newAdName,
        design_id: newDesignId,
        design_name: newDesignName,
        counts,
      };
    });
  }
}
