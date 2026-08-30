import { Mission, Task, AgentType, MissionStatus, TaskStatus, AgentCapability, PermissionScope, SecurityFinding, FindingSeverity, FindingStatus, ApprovalRequest, ApprovalStatus, ToolRequest, ToolExecution, GovernanceDecision, GitCheckpoint, ContextLayer, ModelRoute, AuditEvent } from '../shared/types';

export interface MissionStore {
  create(mission: Mission): Promise<Mission>;
  findById(id: string): Promise<Mission | null>;
  update(mission: Mission): Promise<Mission>;
  findAll(): Promise<Mission[]>;
  findByStatus(status: MissionStatus): Promise<Mission[]>;
}

export interface TaskStore {
  create(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findByMissionId(missionId: string): Promise<Task[]>;
  update(task: Task): Promise<Task>;
  findRunnable(missionId: string): Promise<Task[]>;
}

export class MissionService {
  private missionStore: MissionStore;
  private taskStore: TaskStore;
  private eventBus: any;

  constructor(missionStore: MissionStore, taskStore: TaskStore, eventBus: any) {
    this.missionStore = missionStore;
    this.taskStore = taskStore;
    this.eventBus = eventBus;
  }

  async createMission(objective: string, projectId?: string, metadata: Record<string, unknown> = {}): Promise<Mission> {
    const mission: Mission = {
      id: this.generateId(),
      objective,
      status: MissionStatus.CREATED,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      goals: [],
      metadata
    };

    await this.missionStore.create(mission);
    await this.emitEvent('mission.created', { mission });
    return mission;
  }

  async getMission(id: string): Promise<Mission | null> {
    return this.missionStore.findById(id);
  }

  async updateMission(mission: Mission): Promise<Mission> {
    mission.updatedAt = new Date();
    const updated = await this.missionStore.update(mission);
    await this.emitEvent('mission.updated', { mission: updated });
    return updated;
  }

  async updateMissionStatus(id: string, status: MissionStatus): Promise<Mission | null> {
    const mission = await this.missionStore.findById(id);
    if (!mission) return null;

    mission.status = status;
    mission.updatedAt = new Date();

    if (status === MissionStatus.RUNNING && !mission.startedAt) {
      mission.startedAt = new Date();
    }
    if ([MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.CANCELLED].includes(status)) {
      mission.completedAt = new Date();
    }

    return this.updateMission(mission);
  }

  async addGoals(missionId: string, goals: any[]): Promise<Mission | null> {
    const mission = await this.missionStore.findById(missionId);
    if (!mission) return null;

    mission.goals = goals.map((g, i) => ({ ...g, missionId, id: g.id || this.generateId() }));
    return this.updateMission(mission);
  }

  async addTasks(missionId: string, tasks: Task[]): Promise<Task[]> {
    const createdTasks: Task[] = [];
    for (const task of tasks) {
      task.missionId = missionId;
      task.id = task.id || this.generateId();
      const created = await this.taskStore.create(task);
      createdTasks.push(created);
    }
    await this.emitEvent('tasks.created', { missionId, tasks: createdTasks });
    return createdTasks;
  }

  async getRunnableTasks(missionId: string): Promise<Task[]> {
    return this.taskStore.findRunnable(missionId);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, result?: unknown, error?: string): Promise<Task | null> {
    const task = await this.taskStore.findById(taskId);
    if (!task) return null;

    task.status = status;
    task.updatedAt = new Date();
    if (result) task.result = result;
    if (error) task.error = error;

    if (status === TaskStatus.IMPLEMENTING && !task.startedAt) {
      task.startedAt = new Date();
    }
    if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(status)) {
      task.completedAt = new Date();
    }

    const updated = await this.taskStore.update(task);
    await this.emitEvent('task.updated', { task: updated });
    return updated;
  }

  async pauseMission(missionId: string): Promise<Mission | null> {
    return this.updateMissionStatus(missionId, MissionStatus.PAUSED);
  }

  async resumeMission(missionId: string): Promise<Mission | null> {
    return this.updateMissionStatus(missionId, MissionStatus.RUNNING);
  }

  async cancelMission(missionId: string): Promise<Mission | null> {
    const mission = await this.updateMissionStatus(missionId, MissionStatus.CANCELLED);
    if (mission) {
      const tasks = await this.taskStore.findByMissionId(missionId);
      for (const task of tasks) {
        if ([TaskStatus.CREATED, TaskStatus.ANALYZING, TaskStatus.PLANNED, TaskStatus.APPROVED].includes(task.status)) {
          await this.updateTaskStatus(task.id, TaskStatus.CANCELLED);
        }
      }
    }
    return mission;
  }

  async requestApproval(approval: ApprovalRequest): Promise<ApprovalRequest> {
    await this.emitEvent('approval.requested', { approval });
    return approval;
  }

  async resolveApproval(approvalId: string, approved: boolean, resolvedBy: string, response?: unknown): Promise<void> {
    await this.emitEvent('approval.resolved', { approvalId, approved, resolvedBy, response });
  }

  async recordSecurityFinding(finding: SecurityFinding): Promise<SecurityFinding> {
    await this.emitEvent('security.finding', { finding });
    return finding;
  }

  async recordToolExecution(execution: ToolExecution): Promise<ToolExecution> {
    await this.emitEvent('tool.execution', { execution });
    return execution;
  }

  async recordGitCheckpoint(checkpoint: GitCheckpoint): Promise<GitCheckpoint> {
    await this.emitEvent('git.checkpoint', { checkpoint });
    return checkpoint;
  }

  async recordAuditEvent(event: AuditEvent): Promise<void> {
    await this.emitEvent('audit.event', { event });
  }

  private async emitEvent(type: string, payload: any): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.emit(type, payload);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}