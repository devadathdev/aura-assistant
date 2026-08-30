import { Agent, AgentType, AgentCapability, Task, Mission } from '../shared/types';

export interface AgentRegistry {
  register(agent: Agent): void;
  unregister(agentId: string): void;
  findByCapability(capability: AgentCapability): Agent[];
  findByType(type: AgentType): Agent[];
  findAvailable(capability: AgentCapability): Agent | null;
  getAll(): Agent[];
}

export class InMemoryAgentRegistry implements AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  findByCapability(capability: AgentCapability): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.capabilities.includes(capability));
  }

  findByType(type: AgentType): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.type === type);
  }

  findAvailable(capability: AgentCapability): Agent | null {
    const candidates = this.findByCapability(capability).filter(a => a.status === 'IDLE' && a.health > 50);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.health - a.health);
    return candidates[0];
  }

  getAll(): Agent[] {
    return Array.from(this.agents.values());
  }
}

export class AgentRouter {
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  async routeTask(task: Task, mission: Mission): Promise<Agent | null> {
    if (task.assignedAgent) {
      const agents = this.registry.findByType(task.assignedAgent);
      const available = agents.find(a => a.status === 'IDLE' && a.health > 50);
      if (available) return available;
    }

    for (const capability of task.capabilities) {
      const agent = this.registry.findAvailable(capability);
      if (agent) return agent;
    }

    const fallbackAgents = this.registry.findByType(task.assignedAgent || AgentType.FORGE);
    return fallbackAgents.find(a => a.status === 'IDLE') || null;
  }

  async routeByCapability(capability: AgentCapability): Promise<Agent | null> {
    return this.registry.findAvailable(capability);
  }

  registerAgent(agent: Agent): void {
    this.registry.register(agent);
  }

  unregisterAgent(agentId: string): void {
    this.registry.unregister(agentId);
  }

  updateAgentStatus(agentId: string, status: Agent['status'], health?: number): void {
    const agents = this.registry.getAll();
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      agent.status = status;
      if (health !== undefined) agent.health = health;
      agent.lastHeartbeat = new Date();
    }
  }

  getAgentHealth(agentId: string): number | null {
    const agents = this.registry.getAll();
    const agent = agents.find(a => a.id === agentId);
    return agent?.health || null;
  }
}