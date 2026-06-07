import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import {
  businessWorkspaceSeed,
  createSeedSnapshot,
  isAdvisorKey,
  isBusinessIdeaStatus,
  isBusinessMemberStatus,
  isBusinessRoleKey,
} from "./business.seed.js";
import type {
  BusinessIdeaStatus,
  BusinessMemberRecord,
  BusinessMemberStatus,
  BusinessRoleKey,
  BusinessWorkspaceSnapshot,
} from "./business.types.js";

export type BusinessAccessState = BusinessWorkspaceSnapshot["access"];

export type CreateBusinessMemberInput = {
  name: string;
  roleKey: BusinessRoleKey;
  userId?: string | null;
  invitedEmail?: string | null;
  roleTitle?: string;
  access?: string;
  status?: BusinessMemberStatus;
};

export interface BusinessRepository {
  getWorkspace(userId: string, access: BusinessAccessState): Promise<BusinessWorkspaceSnapshot | null>;
  addMember(
    userId: string,
    input: CreateBusinessMemberInput,
    access: BusinessAccessState
  ): Promise<BusinessWorkspaceSnapshot | null>;
  addDealNote(
    userId: string,
    dealId: string,
    text: string,
    access: BusinessAccessState
  ): Promise<BusinessWorkspaceSnapshot | null>;
  updateIdeaStatus(
    userId: string,
    ideaId: string,
    status: BusinessIdeaStatus,
    access: BusinessAccessState
  ): Promise<BusinessWorkspaceSnapshot | null>;
}

export class InMemoryBusinessRepository implements BusinessRepository {
  private readonly workspaces = new Map<string, BusinessWorkspaceSnapshot>();

  async getWorkspace(userId: string, access: BusinessAccessState) {
    return this.clone(this.getOrCreateWorkspace(userId, access));
  }

  async addMember(userId: string, input: CreateBusinessMemberInput, access: BusinessAccessState) {
    const workspace = this.getOrCreateWorkspace(userId, access);
    const now = new Date().toISOString();
    const role = businessWorkspaceSeed.roles.find((candidate) => candidate.key === input.roleKey);
    const member: BusinessMemberRecord = {
      id: randomUUID(),
      workspaceId: workspace.workspace.id,
      userId: input.userId ?? null,
      invitedEmail: input.invitedEmail?.trim().toLowerCase() || null,
      name: input.name,
      roleKey: input.roleKey,
      roleTitle: input.roleTitle ?? role?.title ?? input.roleKey,
      access: input.access ?? role?.permissions.join(", ") ?? "Ограниченный доступ",
      status: input.status ?? "offline",
      createdAt: now,
      updatedAt: now,
    };

    workspace.members = [...workspace.members, member];
    workspace.groups = workspace.groups.map((group, index) =>
      index === 0 ? { ...group, memberIds: [...new Set([...group.memberIds, member.id])], updatedAt: now } : group
    );
    workspace.employeeReports = [
      ...workspace.employeeReports,
      {
        id: randomUUID(),
        workspaceId: workspace.workspace.id,
        memberId: member.id,
        userId: member.userId,
        employeeName: member.name,
        roleTitle: member.roleTitle,
        reportDate: now.slice(0, 10),
        requestsCount: 0,
        chatsCount: 0,
        clientReportsCount: 0,
        lastActivityAt: null,
        summary: "Сотрудник добавлен. Активность появится после рабочих запросов в чате.",
      },
    ];
    workspace.workspace.updatedAt = now;
    return this.clone(workspace);
  }

  async addDealNote(userId: string, dealId: string, text: string, access: BusinessAccessState) {
    const workspace = this.getOrCreateWorkspace(userId, access);
    const deal = workspace.deals.find((candidate) => candidate.id === dealId);
    if (!deal) return null;

    const now = new Date().toISOString();
    deal.notes = [
      ...deal.notes,
      {
        id: randomUUID(),
        dealId: deal.id,
        text,
        createdAt: now,
      },
    ];
    deal.updatedAt = now;
    workspace.workspace.updatedAt = now;
    return this.clone(workspace);
  }

  async updateIdeaStatus(
    userId: string,
    ideaId: string,
    status: BusinessIdeaStatus,
    access: BusinessAccessState
  ) {
    const workspace = this.getOrCreateWorkspace(userId, access);
    const now = new Date().toISOString();
    const idea = workspace.advisorViews.flatMap((view) => view.ideas).find((candidate) => candidate.id === ideaId);
    if (!idea) return null;

    idea.status = status;
    idea.updatedAt = now;
    workspace.workspace.updatedAt = now;
    return this.clone(workspace);
  }

  private getOrCreateWorkspace(userId: string, access: BusinessAccessState) {
    const existing = this.workspaces.get(userId);
    if (existing) {
      existing.access = access;
      return existing;
    }

    const workspace = createSeedSnapshot(userId, access);
    this.workspaces.set(userId, workspace);
    return workspace;
  }

  private clone(snapshot: BusinessWorkspaceSnapshot) {
    return JSON.parse(JSON.stringify(snapshot)) as BusinessWorkspaceSnapshot;
  }
}

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type MemberRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  invited_email: string | null;
  name: string;
  role_key: string;
  role_title: string;
  access: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type GroupRow = {
  id: string;
  workspace_id: string;
  name: string;
  purpose: string;
  created_at: Date | string;
  updated_at: Date | string;
  member_ids: string[] | null;
} & Record<string, unknown>;

type EmployeeReportRow = {
  id: string;
  workspace_id: string;
  member_id: string | null;
  user_id: string | null;
  employee_name: string | null;
  role_title: string | null;
  report_date: Date | string;
  requests_count: string | number;
  chats_count: string | number;
  client_reports_count: string | number;
  last_activity_at: Date | string | null;
  summary: string | null;
} & Record<string, unknown>;

type DealRow = {
  id: string;
  workspace_id: string;
  slug: string;
  client: string;
  request: string;
  stage: string;
  amount: string;
  source: string;
  next_step: string;
  problem: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type DealNoteRow = {
  id: string;
  deal_id: string;
  deal_slug: string;
  text: string;
  created_at: Date | string;
} & Record<string, unknown>;

type IdeaRow = {
  id: string;
  workspace_id: string;
  slug: string;
  advisor_key: string;
  title: string;
  effort: string;
  effect: string;
  text: string;
  next_step: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

export class PostgresBusinessRepository implements BusinessRepository {
  constructor(private readonly database: DatabaseClient) {}

  async getWorkspace(userId: string, access: BusinessAccessState) {
    const workspace = await this.ensureWorkspace(userId);
    if (!workspace) return null;

    return this.readSnapshot(workspace, access);
  }

  async addMember(userId: string, input: CreateBusinessMemberInput, access: BusinessAccessState) {
    const workspace = await this.ensureWorkspace(userId);
    if (!workspace) return null;

    const role = businessWorkspaceSeed.roles.find((candidate) => candidate.key === input.roleKey);
    const countResult = await this.database.query<{ count: string }>(
      "select count(*)::text as count from business_members where workspace_id = $1",
      [workspace.id]
    );
    const sortOrder = Number(countResult.rows[0]?.count ?? 0) + 1;

    const normalizedInvitedEmail = input.invitedEmail?.trim().toLowerCase() || null;
    const linkedUserId = input.userId ? toDatabaseUserId(input.userId) : await this.findUserIdByEmail(normalizedInvitedEmail);

    const memberResult = await this.database.query<{ id: string }>(
      `
        insert into business_members (
          workspace_id,
          user_id,
          invited_email,
          name,
          role_key,
          role_title,
          access,
          status,
          sort_order
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id
      `,
      [
        workspace.id,
        linkedUserId,
        normalizedInvitedEmail,
        input.name,
        input.roleKey,
        input.roleTitle ?? role?.title ?? input.roleKey,
        input.access ?? role?.permissions.join(", ") ?? "Ограниченный доступ",
        input.status ?? "offline",
        sortOrder,
      ]
    );

    await this.addMemberToDefaultGroup(workspace.id, memberResult.rows[0]?.id ?? null);
    return this.readSnapshot(workspace, access);
  }

  async addDealNote(userId: string, dealId: string, text: string, access: BusinessAccessState) {
    const workspace = await this.ensureWorkspace(userId);
    if (!workspace) return null;

    const dealResult = await this.database.query<{ id: string }>(
      `
        select id
        from business_deals
        where workspace_id = $1
          and (slug = $2 or id::text = $2)
        limit 1
      `,
      [workspace.id, dealId]
    );
    const deal = dealResult.rows[0];
    if (!deal) return null;

    await this.database.query(
      `
        insert into business_deal_notes (deal_id, text)
        values ($1, $2)
      `,
      [deal.id, text]
    );

    await this.database.query("update business_deals set updated_at = now() where id = $1", [deal.id]);
    return this.readSnapshot(workspace, access);
  }

  async updateIdeaStatus(userId: string, ideaId: string, status: BusinessIdeaStatus, access: BusinessAccessState) {
    const workspace = await this.ensureWorkspace(userId);
    if (!workspace) return null;

    const result = await this.database.query(
      `
        update business_ideas
        set status = $3,
            updated_at = now()
        where workspace_id = $1
          and (slug = $2 or id::text = $2)
      `,
      [workspace.id, ideaId, status]
    );
    if (result.rowCount === 0) return null;

    return this.readSnapshot(workspace, access);
  }

  private async findUserIdByEmail(email: string | null) {
    if (!email) return null;
    const result = await this.database.query<{ id: string }>(
      "select id from users where lower(email) = $1 limit 1",
      [email]
    );
    return result.rows[0]?.id ?? null;
  }

  private async addMemberToDefaultGroup(workspaceId: string, memberId: string | null) {
    if (!memberId) return;
    await this.database.query(
      `
        insert into business_group_members (group_id, member_id)
        select g.id, $2
        from business_groups g
        where g.workspace_id = $1
        order by g.created_at asc
        limit 1
        on conflict (group_id, member_id) do nothing
      `,
      [workspaceId, memberId]
    );
  }

  private async ensureWorkspace(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    if (userId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(this.database);
    }

    const existingWorkspace = await this.database.query<WorkspaceRow>(
      `
        select id, user_id, name, created_at, updated_at
        from business_workspaces
        where user_id = $1
        limit 1
      `,
      [databaseUserId]
    );
    if (existingWorkspace.rows[0]) {
      await this.seedWorkspaceRows(existingWorkspace.rows[0].id, existingWorkspace.rows[0].user_id, existingWorkspace.rows[0].name);
      return existingWorkspace.rows[0];
    }

    const employeeWorkspace = await this.database.query<WorkspaceRow>(
      `
        select w.id, w.user_id, w.name, w.created_at, w.updated_at
        from business_members m
        join business_workspaces w on w.id = m.workspace_id
        where m.user_id = $1
        order by m.created_at desc
        limit 1
      `,
      [databaseUserId]
    );
    if (employeeWorkspace.rows[0]) {
      await this.seedWorkspaceRows(employeeWorkspace.rows[0].id, employeeWorkspace.rows[0].user_id, employeeWorkspace.rows[0].name);
      return employeeWorkspace.rows[0];
    }

    const result = await this.database.query<WorkspaceRow>(
      `
        insert into business_workspaces (user_id, name)
        values ($1, $2)
        on conflict (user_id) do update
          set name = business_workspaces.name,
              updated_at = business_workspaces.updated_at
        returning id, user_id, name, created_at, updated_at
      `,
      [databaseUserId, businessWorkspaceSeed.workspaceName]
    );
    const workspace = result.rows[0];
    if (!workspace) return null;

    await this.seedWorkspaceRows(workspace.id, databaseUserId, workspace.name);
    return workspace;
  }

  private async seedWorkspaceRows(workspaceId: string, ownerUserId: string, workspaceName: string) {
    for (const [index, member] of businessWorkspaceSeed.members.entries()) {
      await this.database.query(
        `
          insert into business_members (
            workspace_id,
            user_id,
            seat_key,
            name,
            role_key,
            role_title,
            access,
            status,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (workspace_id, seat_key) do update
            set name = excluded.name,
                user_id = coalesce(business_members.user_id, excluded.user_id),
                role_key = excluded.role_key,
                role_title = excluded.role_title,
                access = excluded.access,
                updated_at = now()
        `,
        [
          workspaceId,
          member.roleKey === "owner" ? ownerUserId : null,
          member.id,
          member.name,
          member.roleKey,
          member.roleTitle,
          member.access,
          member.status,
          index + 1,
        ]
      );
    }

    const groupResult = await this.database.query<{ id: string }>(
      `
        insert into business_groups (workspace_id, name, purpose, created_by_user_id)
        values ($1, $2, $3, $4)
        on conflict (workspace_id, name) do update
          set purpose = excluded.purpose,
              updated_at = business_groups.updated_at
        returning id
      `,
      [
        workspaceId,
        `${workspaceName}: общая группа`,
        "Рабочее пространство, которое автоматически создается после подключения Business.",
        ownerUserId,
      ]
    );
    const groupId = groupResult.rows[0]?.id;
    if (groupId) {
      await this.database.query(
        `
          insert into business_group_members (group_id, member_id)
          select $1, m.id
          from business_members m
          where m.workspace_id = $2
          on conflict (group_id, member_id) do nothing
        `,
        [groupId, workspaceId]
      );
    }

    for (const [index, deal] of businessWorkspaceSeed.deals.entries()) {
      const dealResult = await this.database.query<{ id: string }>(
        `
          insert into business_deals (
            workspace_id,
            slug,
            client,
            request,
            stage,
            amount,
            source,
            next_step,
            problem,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          on conflict (workspace_id, slug) do update
            set client = excluded.client,
                request = excluded.request,
                stage = excluded.stage,
                amount = excluded.amount,
                source = excluded.source,
                next_step = excluded.next_step,
                problem = excluded.problem,
                sort_order = excluded.sort_order,
                updated_at = business_deals.updated_at
          returning id
        `,
        [
          workspaceId,
          deal.slug,
          deal.client,
          deal.request,
          deal.stage,
          deal.amount,
          deal.source,
          deal.nextStep,
          deal.problem,
          index + 1,
        ]
      );
      const dealId = dealResult.rows[0]?.id;
      if (!dealId) continue;

      for (const note of deal.notes) {
        await this.database.query(
          `
            insert into business_deal_notes (deal_id, text, created_at)
            select $1, $2, $3
            where not exists (
              select 1
              from business_deal_notes
              where deal_id = $1 and text = $2
            )
          `,
          [dealId, note.text, note.createdAt]
        );
      }
    }

    let sortOrder = 1;
    for (const advisor of businessWorkspaceSeed.advisors) {
      for (const idea of advisor.ideas) {
        await this.database.query(
          `
            insert into business_ideas (
              workspace_id,
              slug,
              advisor_key,
              title,
              effort,
              effect,
              text,
              next_step,
              status,
              sort_order
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            on conflict (workspace_id, slug) do update
              set advisor_key = excluded.advisor_key,
                  title = excluded.title,
                  effort = excluded.effort,
                  effect = excluded.effect,
                  text = excluded.text,
                  next_step = excluded.next_step,
                  sort_order = excluded.sort_order,
                  updated_at = business_ideas.updated_at
          `,
          [
            workspaceId,
            idea.slug,
            idea.advisorKey,
            idea.title,
            idea.effort,
            idea.effect,
            idea.text,
            idea.next,
            idea.status,
            sortOrder,
          ]
        );
        sortOrder += 1;
      }
    }
  }

  private async readSnapshot(workspace: WorkspaceRow, access: BusinessAccessState): Promise<BusinessWorkspaceSnapshot> {
    const [membersResult, groupsResult, reportsResult, dealsResult, notesResult, ideasResult] = await Promise.all([
      this.database.query<MemberRow>(
        `
          select
            id,
            workspace_id,
            user_id,
            invited_email,
            name,
            role_key,
            role_title,
            access,
            status,
            created_at,
            updated_at
          from business_members
          where workspace_id = $1
          order by sort_order asc, created_at asc
        `,
        [workspace.id]
      ),
      this.database.query<GroupRow>(
        `
          select
            g.id,
            g.workspace_id,
            g.name,
            g.purpose,
            g.created_at,
            g.updated_at,
            coalesce(array_agg(gm.member_id::text order by gm.created_at) filter (where gm.member_id is not null), '{}') as member_ids
          from business_groups g
          left join business_group_members gm on gm.group_id = g.id
          where g.workspace_id = $1
          group by g.id
          order by g.created_at asc
        `,
        [workspace.id]
      ),
      this.database.query<EmployeeReportRow>(
        `
          select
            coalesce(r.id::text, m.id::text || '-empty-report') as id,
            m.workspace_id,
            m.id as member_id,
            m.user_id,
            m.name as employee_name,
            m.role_title,
            coalesce(r.report_date, current_date) as report_date,
            coalesce(r.requests_count, 0)::text as requests_count,
            coalesce(r.chats_count, 0)::text as chats_count,
            coalesce(r.client_reports_count, 0)::text as client_reports_count,
            r.last_activity_at,
            coalesce(r.summary, 'Активность появится после рабочих запросов в чате.') as summary
          from business_members m
          left join business_employee_daily_reports r
            on r.member_id = m.id
           and r.report_date = current_date
          where m.workspace_id = $1
          order by m.sort_order asc, m.created_at asc
        `,
        [workspace.id]
      ),
      this.database.query<DealRow>(
        `
          select
            id,
            workspace_id,
            slug,
            client,
            request,
            stage,
            amount,
            source,
            next_step,
            problem,
            created_at,
            updated_at
          from business_deals
          where workspace_id = $1
          order by sort_order asc, created_at asc
        `,
        [workspace.id]
      ),
      this.database.query<DealNoteRow>(
        `
          select
            n.id,
            n.deal_id,
            d.slug as deal_slug,
            n.text,
            n.created_at
          from business_deal_notes n
          join business_deals d on d.id = n.deal_id
          where d.workspace_id = $1
          order by n.created_at asc
        `,
        [workspace.id]
      ),
      this.database.query<IdeaRow>(
        `
          select
            id,
            workspace_id,
            slug,
            advisor_key,
            title,
            effort,
            effect,
            text,
            next_step,
            status,
            created_at,
            updated_at
          from business_ideas
          where workspace_id = $1
          order by sort_order asc, created_at asc
        `,
        [workspace.id]
      ),
    ]);

    const notesByDeal = new Map<string, DealNoteRow[]>();
    for (const note of notesResult.rows) {
      const existing = notesByDeal.get(note.deal_slug) ?? [];
      existing.push(note);
      notesByDeal.set(note.deal_slug, existing);
    }

    const ideasByAdvisor = new Map<string, IdeaRow[]>();
    for (const idea of ideasResult.rows) {
      const existing = ideasByAdvisor.get(idea.advisor_key) ?? [];
      existing.push(idea);
      ideasByAdvisor.set(idea.advisor_key, existing);
    }

    return {
      workspace: {
        id: workspace.id,
        userId: toPublicUserId(workspace.user_id),
        name: workspace.name,
        createdAt: toIso(workspace.created_at),
        updatedAt: toIso(workspace.updated_at),
      },
      access,
      roles: [...businessWorkspaceSeed.roles],
      members: membersResult.rows
        .filter((member) => isBusinessRoleKey(member.role_key) && isBusinessMemberStatus(member.status))
        .map((member) => ({
          id: member.id,
          workspaceId: member.workspace_id,
          userId: member.user_id ? toPublicUserId(member.user_id) : null,
          invitedEmail: member.invited_email,
          name: member.name,
          roleKey: member.role_key as BusinessRoleKey,
          roleTitle: member.role_title,
          access: member.access,
          status: member.status as BusinessMemberStatus,
          createdAt: toIso(member.created_at),
          updatedAt: toIso(member.updated_at),
        })),
      groups: groupsResult.rows.map((group) => ({
        id: group.id,
        workspaceId: group.workspace_id,
        name: group.name,
        purpose: group.purpose,
        memberIds: group.member_ids ?? [],
        createdAt: toIso(group.created_at),
        updatedAt: toIso(group.updated_at),
      })),
      employeeReports: reportsResult.rows.map((report) => ({
        id: report.id,
        workspaceId: report.workspace_id,
        memberId: report.member_id,
        userId: report.user_id ? toPublicUserId(report.user_id) : null,
        employeeName: report.employee_name ?? "Сотрудник",
        roleTitle: report.role_title ?? "Роль",
        reportDate: toDateOnly(report.report_date),
        requestsCount: Number(report.requests_count),
        chatsCount: Number(report.chats_count),
        clientReportsCount: Number(report.client_reports_count),
        lastActivityAt: report.last_activity_at ? toIso(report.last_activity_at) : null,
        summary: report.summary ?? "Активность появится после рабочих запросов в чате.",
      })),
      stats: [...businessWorkspaceSeed.stats],
      knowledgeSources: [...businessWorkspaceSeed.knowledgeSources],
      paidServices: [...businessWorkspaceSeed.paidServices],
      pipeline: [...businessWorkspaceSeed.pipeline],
      deals: dealsResult.rows.map((deal) => ({
        id: deal.slug,
        workspaceId: deal.workspace_id,
        client: deal.client,
        request: deal.request,
        stage: deal.stage,
        amount: deal.amount,
        source: deal.source,
        nextStep: deal.next_step,
        problem: deal.problem,
        createdAt: toIso(deal.created_at),
        updatedAt: toIso(deal.updated_at),
        notes: (notesByDeal.get(deal.slug) ?? []).map((note) => ({
          id: note.id,
          dealId: note.deal_slug,
          text: note.text,
          createdAt: toIso(note.created_at),
        })),
      })),
      customerSignals: [...businessWorkspaceSeed.customerSignals],
      trafficSources: [...businessWorkspaceSeed.trafficSources],
      advisorViews: businessWorkspaceSeed.advisors.map((advisor) => ({
        key: advisor.key,
        title: advisor.title,
        short: advisor.short,
        summary: advisor.summary,
        basedOn: [...advisor.basedOn],
        ideas: (ideasByAdvisor.get(advisor.key) ?? [])
          .filter((idea) => isAdvisorKey(idea.advisor_key) && isBusinessIdeaStatus(idea.status))
          .map((idea) => ({
            id: idea.slug,
            workspaceId: idea.workspace_id,
            advisorKey: idea.advisor_key as typeof advisor.key,
            title: idea.title,
            effort: idea.effort,
            effect: idea.effect,
            text: idea.text,
            next: idea.next_step,
            status: idea.status as BusinessIdeaStatus,
            createdAt: toIso(idea.created_at),
            updatedAt: toIso(idea.updated_at),
          })),
      })),
    };
  }
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string) {
  return toIso(value).slice(0, 10);
}
