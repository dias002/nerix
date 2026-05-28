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

