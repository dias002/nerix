import type { AgentCategory, AiModality } from "@nomduchat/shared";
import type { DatabaseClient } from "../../database/index.js";
import type { AgentRecord, CreateAgentInput } from "./agent.types.js";

export interface AgentRepository {
  listAll(): Promise<AgentRecord[]>;
  listEnabled(): Promise<AgentRecord[]>;
  findById(id: string): Promise<AgentRecord | null>;
  upsert(input: CreateAgentInput): Promise<AgentRecord>;
  updateEnabled(id: string, enabled: boolean): Promise<AgentRecord | null>;
}

export const seedAgents: CreateAgentInput[] = [
  {
    id: "general",
    name: "nomduchat Chat",
    category: "general",
    description: "Main assistant for everyday tasks.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "text-primary",
    fallbackModels: ["text-fast"],
    priceMultiplier: 1,
    systemPrompt:
      "You are nomduchat Chat, a concise multilingual assistant. Answer directly when the user gave enough context. For creative writing, produce a useful first draft instead of asking for extra details first.",
  },
  {
    id: "code",
    name: "nomduchat Code",
    category: "code",
    description: "Agent for code, architecture, debugging, and refactoring.",
    inputTypes: ["text", "code", "file"],
    outputTypes: ["text", "code"],
    defaultModel: "code-primary",
    fallbackModels: ["text-primary"],
    priceMultiplier: 1.4,
    systemPrompt: "You are nomduchat Code, a pragmatic software engineering agent.",
  },
  {
    id: "business",
    name: "nomduchat Business",
    category: "business",
    description: "Agent for business processes, sales, support, and documents.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "business-primary",
    fallbackModels: ["text-primary"],
    priceMultiplier: 1.2,
    systemPrompt: "You are nomduchat Business, an operations and growth assistant.",
  },
  {
    id: "study",
    name: "nomduchat Study",
    category: "study",
    description: "Agent for learning plans, explanations, and exam preparation.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "text-primary",
    fallbackModels: ["text-fast"],
    priceMultiplier: 1,
  },
  {
    id: "image",
    name: "nomduchat Image",
    category: "image",
    description: "Agent for image generation, visual concepts, covers, and avatars.",
    inputTypes: ["text", "image", "file"],
    outputTypes: ["image", "text"],
    defaultModel: "image-primary",
    fallbackModels: ["image-fast", "text-primary"],
    priceMultiplier: 2.4,
    systemPrompt: "You are nomduchat Image, a visual generation and prompt design agent.",
  },
  {
    id: "video",
    name: "nomduchat Video",
    category: "video",
    description: "Agent for short videos, reels, scenes, scripts, and storyboards.",
    inputTypes: ["text", "image", "video", "file"],
    outputTypes: ["video", "text"],
    defaultModel: "video-primary",
    fallbackModels: ["video-fast", "image-primary", "text-primary"],
    priceMultiplier: 6,
    systemPrompt: "You are nomduchat Video, a short-form video and storyboard agent.",
  },
  {
    id: "music",
    name: "nomduchat Music",
    category: "music",
    description: "Agent for songs, melodies, lyrics, jingles, and audio concepts.",
    inputTypes: ["text", "music", "file"],
    outputTypes: ["music", "text"],
    defaultModel: "music-primary",
    fallbackModels: ["music-fast", "text-primary"],
    priceMultiplier: 3.5,
    systemPrompt:
      "You are nomduchat Music, a music generation, lyrics, and audio concept agent. If the user asks to write or compose a song, write the lyrics directly in the requested language, with a clear structure such as verses and chorus. Ask follow-up questions only after giving a usable first version, unless the request is impossible to answer.",
  },
  {
    id: "voice",
    name: "nomduchat Voice",
    category: "voice",
    description: "Agent for voiceovers, speech, dubbing, and voice prompts.",
    inputTypes: ["text", "voice", "file"],
    outputTypes: ["voice", "text"],
    defaultModel: "voice-primary",
    fallbackModels: ["voice-fast", "text-primary"],
    priceMultiplier: 2,
    systemPrompt: "You are nomduchat Voice, a voiceover, speech, and dubbing agent.",
  },
  {
    id: "documents",
    name: "nomduchat Documents",
    category: "documents",
    description: "Agent for files, summaries, contracts, tables, and document review.",
    inputTypes: ["text", "file"],
    outputTypes: ["text", "file"],
    defaultModel: "text-primary",
    fallbackModels: ["text-fast"],
    priceMultiplier: 1.3,
    systemPrompt: "You are nomduchat Documents, a careful document analysis and drafting agent.",
  },
  {
    id: "marketing",
    name: "nomduchat Marketing",
    category: "marketing",
    description: "Agent for ads, posts, landing copy, offers, and creative campaigns.",
    inputTypes: ["text", "image", "file"],
    outputTypes: ["text", "image"],
    defaultModel: "marketing-primary",
    fallbackModels: ["text-primary", "image-fast"],
    priceMultiplier: 1.5,
    systemPrompt: "You are nomduchat Marketing, a practical marketing and creative campaign agent.",
  },
  {
    id: "support",
    name: "nomduchat Support",
    category: "support",
    description: "Agent for customer support replies, FAQ, CRM notes, and service scripts.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "support-primary",
    fallbackModels: ["business-primary", "text-primary"],
    priceMultiplier: 1.2,
    systemPrompt: "You are nomduchat Support, a calm customer support and service operations agent.",
  },
];

export class InMemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, AgentRecord>();

  constructor(initialAgents = seedAgents) {
    initialAgents.forEach((agent) => {
      const record = toRecord(agent);
      this.agents.set(record.id, record);
    });
  }

  async listAll() {
    return [...this.agents.values()];
  }

  async listEnabled() {
    return [...this.agents.values()].filter((agent) => agent.enabled);
  }

  async findById(id: string) {
    return this.agents.get(id) ?? null;
  }

  async upsert(input: CreateAgentInput) {
    const existing = this.agents.get(input.id);
    const record = toRecord(input, existing?.enabled);
    this.agents.set(record.id, record);
    return record;
  }

  async updateEnabled(id: string, enabled: boolean) {
    const current = this.agents.get(id);
    if (!current) return null;

    const next = { ...current, enabled };
    this.agents.set(id, next);
    return next;
  }
}

type AgentRow = {
  slug: string;
  name: string;
  category: string;
  description: string;
  input_types: string[];
  output_types: string[];
  default_model: string;
  fallback_models: string[];
  price_multiplier: string | number;
  enabled: boolean;
  system_prompt: string;
  country_denylist: string[];
} & Record<string, unknown>;

export class PostgresAgentRepository implements AgentRepository {
  private seeded = false;

  constructor(
    private readonly database: DatabaseClient,
    private readonly initialAgents = seedAgents
  ) {}

  async listEnabled() {
    await this.ensureSeeded();

    const result = await this.database.query<AgentRow>(
      `
        select
          slug,
          name,
          category,
          description,
          input_types,
          output_types,
          default_model,
          fallback_models,
          price_multiplier,
          enabled,
          system_prompt,
          country_denylist
        from agents
        where enabled = true
        order by created_at asc
      `
    );

    return result.rows.map(mapAgentRow);
  }

  async listAll() {
    await this.ensureSeeded();

    const result = await this.database.query<AgentRow>(
      `
        select
          slug,
          name,
          category,
          description,
          input_types,
          output_types,
          default_model,
          fallback_models,
          price_multiplier,
          enabled,
          system_prompt,
          country_denylist
        from agents
        order by created_at asc
      `
    );

    return result.rows.map(mapAgentRow);
  }

  async findById(id: string) {
    await this.ensureSeeded();

    const result = await this.database.query<AgentRow>(
      `
        select
          slug,
          name,
          category,
          description,
          input_types,
          output_types,
          default_model,
          fallback_models,
          price_multiplier,
          enabled,
          system_prompt,
          country_denylist
        from agents
        where slug = $1
        limit 1
      `,
      [id]
    );

    const row = result.rows[0];
    return row ? mapAgentRow(row) : null;
  }

  async upsert(input: CreateAgentInput) {
    const record = toRecord(input);

    await this.database.query(
      `
        insert into agents (
          slug,
          name,
          category,
          description,
          system_prompt,
          input_types,
          output_types,
          default_model,
          fallback_models,
          country_denylist,
          price_multiplier,
          enabled
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        on conflict (slug) do update set
          name = excluded.name,
          category = excluded.category,
          description = excluded.description,
          system_prompt = excluded.system_prompt,
          input_types = excluded.input_types,
          output_types = excluded.output_types,
          default_model = excluded.default_model,
          fallback_models = excluded.fallback_models,
          country_denylist = excluded.country_denylist,
          price_multiplier = excluded.price_multiplier,
          updated_at = now()
      `,
      [
        record.id,
        record.name,
        record.category,
        record.description,
        record.systemPrompt,
        record.inputTypes,
        record.outputTypes,
        record.defaultModel,
        record.fallbackModels,
        record.countryDenylist,
        record.priceMultiplier,
      ]
    );

    return record;
  }

  async updateEnabled(id: string, enabled: boolean) {
    await this.ensureSeeded();

    const result = await this.database.query<AgentRow>(
      `
        update agents
        set enabled = $2, updated_at = now()
        where slug = $1
        returning
          slug,
          name,
          category,
          description,
          input_types,
          output_types,
          default_model,
          fallback_models,
          price_multiplier,
          enabled,
          system_prompt,
          country_denylist
      `,
      [id, enabled]
    );

    const row = result.rows[0];
    return row ? mapAgentRow(row) : null;
  }

  private async ensureSeeded() {
    if (this.seeded) return;

    for (const agent of this.initialAgents) {
      await this.upsert(agent);
    }

    this.seeded = true;
  }
}

function toRecord(input: CreateAgentInput, enabled = true): AgentRecord {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    description: input.description,
    inputTypes: input.inputTypes,
    outputTypes: input.outputTypes,
    defaultModel: input.defaultModel,
    fallbackModels: input.fallbackModels ?? [],
    priceMultiplier: input.priceMultiplier ?? 1,
    enabled,
    systemPrompt: input.systemPrompt ?? "",
    countryDenylist: input.countryDenylist ?? [],
  };
}

function mapAgentRow(row: AgentRow): AgentRecord {
  return {
    id: row.slug,
    name: row.name,
    category: row.category as AgentCategory,
    description: row.description,
    inputTypes: toStringArray(row.input_types) as AiModality[],
    outputTypes: toStringArray(row.output_types) as AiModality[],
    defaultModel: row.default_model,
    fallbackModels: toStringArray(row.fallback_models),
    priceMultiplier: typeof row.price_multiplier === "number" ? row.price_multiplier : Number(row.price_multiplier),
    enabled: row.enabled,
    systemPrompt: row.system_prompt,
    countryDenylist: toStringArray(row.country_denylist),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
