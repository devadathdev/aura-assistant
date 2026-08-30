import { ContextLayer } from '../shared/types';

export class ContextManager {
  private layers: ContextLayer = {
    userContext: {},
    projectContext: {},
    missionContext: {},
    agentContext: {},
    taskContext: {}
  };

  private layerHistory: ContextLayer[] = [];

  setUserContext(context: Record<string, unknown>): void {
    this.layers.userContext = { ...this.layers.userContext, ...context };
  }

  setProjectContext(context: Record<string, unknown>): void {
    this.layers.projectContext = { ...this.layers.projectContext, ...context };
  }

  setMissionContext(context: Record<string, unknown>): void {
    this.layers.missionContext = { ...this.layers.missionContext, ...context };
  }

  setAgentContext(agentType: string, context: Record<string, unknown>): void {
    this.layers.agentContext = { ...this.layers.agentContext, [agentType]: context };
  }

  setTaskContext(taskId: string, context: Record<string, unknown>): void {
    this.layers.taskContext = { ...this.layers.taskContext, [taskId]: context };
  }

  getContextForAgent(agentType: string): Record<string, unknown> {
    return {
      user: this.layers.userContext,
      project: this.layers.projectContext,
      mission: this.layers.missionContext,
      agent: this.layers.agentContext[agentType] || {}
    };
  }

  getContextForTask(taskId: string): Record<string, unknown> {
    return {
      user: this.layers.userContext,
      project: this.layers.projectContext,
      mission: this.layers.missionContext,
      agent: this.layers.agentContext,
      task: this.layers.taskContext[taskId] || {}
    };
  }

  getFullContext(): ContextLayer {
    return { ...this.layers };
  }

  snapshot(): void {
    this.layerHistory.push(JSON.parse(JSON.stringify(this.layers)));
  }

  restoreSnapshot(index: number = -1): boolean {
    if (this.layerHistory.length === 0) return false;
    const snapshot = this.layerHistory[index];
    if (snapshot) {
      this.layers = snapshot;
      return true;
    }
    return false;
  }

  clear(): void {
    this.layers = {
      userContext: {},
      projectContext: {},
      missionContext: {},
      agentContext: {},
      taskContext: {}
    };
  }
}