import type { AgentCategory, AiModality } from "@nerix/shared";
import type { DatabaseClient } from "../../database/index.js";
import type { AgentRecord, CreateAgentInput } from "./agent.types.js";

export interface AgentRepository {
  listEnabled(): Promise<AgentRecord[]>;
  findById(id: string): Promise<AgentRecord | null>;
  upsert(input: CreateAgentInput): Promise<AgentRecord>;
}

const seedAgents: CreateAgentInput[] = [
  {
    id: "general",
    name: "Nerix Chat",
    category: "general",
    description: "Main assistant for everyday tasks.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "text-primary",
    fallbackModels: ["text-fast"],
    priceMultiplier: 1,
    systemPrompt: "You are Nerix Chat, a concise multilingual assistant.",
  },
  {
    id: "code",
    name: "Nerix Code",
    category: "code",
    description: "Agent for code, architecture, debugging, and refactoring.",
    inputTypes: ["text", "code", "file"],
    outputTypes: ["text", "code"],
    defaultModel: "code-primary",
    fallbackModels: ["text-primary"],
    priceMultiplier: 1.4,
    systemPrompt: "You are Nerix Code, a pragmatic software engineering agent.",
  },
  {
    id: "business",
    name: "Nerix Business",
    category: "business",
    description: "Agent for business processes, sales, support, and documents.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "business-primary",
    fallbackModels: ["text-primary"],
    priceMultiplier: 1.2,
    systemPrompt: "You are Nerix Business, an operations and growth assistant.",
  },
  {
    id: "study",
    name: "Nerix Study",
    category: "study",
    description: "Agent for learning plans, explanations, and exam preparation.",
    inputTypes: ["text", "file"],
    outputTypes: ["text"],
    defaultModel: "text-primary",
    fallbackModels: ["text-fast"],
    priceMultiplier: 1,
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

  async listEnabled() {
    return [...this.agents.values()].filter((agent) => agent.enabled);
  }

  async findById(id: string) {
    return this.agents.get(id) ?? null;
  }

  async upsert(input: CreateAgentInput) {
    const record = toRecord(input);
    this.agents.set(record.id, record);
    return record;
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
          enabled = excluded.enabled,
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

  private async ensureSeeded() {
    if (this.seeded) return;

    for (const agent of this.initialAgents) {
      await this.upsert(agent);
    }

    this.seeded = true;
  }
}

function toRecord(input: CreateAgentInput): AgentRecord {
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
    enabled: true,
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
