import { NoopDatabaseClient, type DatabaseClient } from "../database/index.js";
import { InMemoryAgentRepository } from "../modules/agents/agent.repository.js";
import { AgentService } from "../modules/agents/agent.service.js";
import { AiGatewayService } from "../modules/ai-gateway/ai-gateway.service.js";
import { InMemoryWalletRepository } from "../modules/billing/wallet.repository.js";
import { BillingService } from "../modules/billing/billing.service.js";
import { ChatService } from "../modules/chat/chat.service.js";
import { InMemoryConversationRepository } from "../modules/chat/conversation.repository.js";
import { InMemoryUserRepository } from "../modules/users/user.repository.js";
import { UserService } from "../modules/users/user.service.js";

export type AppDependencies = {
  database: DatabaseClient;
  users: UserService;
  billing: BillingService;
  agents: AgentService;
  aiGateway: AiGatewayService;
  chat: ChatService;
};

export type CreateDependenciesOptions = {
  database?: DatabaseClient;
};

export function createDependencies(options: CreateDependenciesOptions = {}): AppDependencies {
  const userRepository = new InMemoryUserRepository();
  const walletRepository = new InMemoryWalletRepository();
  const agentRepository = new InMemoryAgentRepository();
  const conversationRepository = new InMemoryConversationRepository();

  const users = new UserService(userRepository);
  const agents = new AgentService(agentRepository);
  const billing = new BillingService(walletRepository, agents);
  const aiGateway = new AiGatewayService(agents, billing);
  const chat = new ChatService(conversationRepository, aiGateway);

  return {
    database: options.database ?? new NoopDatabaseClient(),
    users,
    billing,
    agents,
    aiGateway,
    chat,
  };
}
