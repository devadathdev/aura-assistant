import { Mission, Goal, Milestone, Task, AgentCapability, PermissionScope, TaskStatus, MissionStatus, AgentType, RiskLevel } from '../shared/types';

export interface Plan {
  goals: Goal[];
  tasks: Task[];
  estimatedDuration: number;
  riskLevel: RiskLevel;
  requiredApprovals: string[];
}

export class PlannerService {
  private intentService: any;

  constructor(intentService: any) {
    this.intentService = intentService;
  }

  async createPlan(mission: Mission, intentResult: any): Promise<Plan> {
    const goals = await this.decomposeIntoGoals(mission.objective, intentResult);
    const tasks = await this.decomposeIntoTasks(goals, intentResult);
    const estimatedDuration = this.estimateDuration(tasks);
    const riskLevel = this.assessRisk(tasks);
    const requiredApprovals = this.identifyRequiredApprovals(tasks);

    return {
      goals,
      tasks,
      estimatedDuration,
      riskLevel,
      requiredApprovals
    };
  }

  private async decomposeIntoGoals(objective: string, intentResult: any): Promise<Goal[]> {
    const goals: Goal[] = [];

    if (intentResult.suggestedAgentTypes.includes(AgentType.FORGE)) {
      goals.push({
        id: this.generateId(),
        missionId: '',
        title: 'Engineering Implementation',
        description: 'Design, implement, and test the software solution',
        milestones: [],
        status: 'PENDING'
      });
    }

    if (intentResult.suggestedAgentTypes.includes(AgentType.SENTINEL)) {
      goals.push({
        id: this.generateId(),
        missionId: '',
        title: 'Security Analysis & Verification',
        description: 'Perform threat modeling, static analysis, and independent verification',
        milestones: [],
        status: 'PENDING'
      });
    }

    if (intentResult.suggestedAgentTypes.includes(AgentType.RESEARCH)) {
      goals.push({
        id: this.generateId(),
        missionId: '',
        title: 'Research & Knowledge Gathering',
        description: 'Gather required technical knowledge and validate assumptions',
        milestones: [],
        status: 'PENDING'
      });
    }

    if (intentResult.suggestedAgentTypes.includes(AgentType.AUTOMATION)) {
      goals.push({
        id: this.generateId(),
        missionId: '',
        title: 'Deployment & Operations',
        description: 'Deploy to target environment and configure monitoring',
        milestones: [],
        status: 'PENDING'
      });
    }

    return goals;
  }

  private async decomposeIntoTasks(goals: Goal[], intentResult: any): Promise<Task[]> {
    const tasks: Task[] = [];
    let taskIndex = 0;

    for (const goal of goals) {
      const goalTasks = this.createTasksForGoal(goal, intentResult, taskIndex);
      tasks.push(...goalTasks);
      taskIndex += goalTasks.length;
    }

    this.addDependencies(tasks, intentResult);
    return tasks;
  }

  private createTasksForGoal(goal: Goal, intentResult: any, startIndex: number): Task[] {
    const tasks: Task[] = [];

    if (goal.title === 'Engineering Implementation') {
      tasks.push(
        this.createTask(`task-${startIndex}`, 'REPOSITORY_INSPECTION', 'Inspect Repository', 'Analyze existing codebase structure and patterns', AgentType.FORGE, [AgentCapability.REPOSITORY_INSPECTION], [PermissionScope.FILESYSTEM_READ], 'LOW'),
        this.createTask(`task-${startIndex + 1}`, 'ARCHITECTURE_PLANNING', 'Create Architecture Plan', 'Design system architecture and implementation approach', AgentType.FORGE, [AgentCapability.ARCHITECTURE_PLANNING], [PermissionScope.FILESYSTEM_READ], 'LOW'),
        this.createTask(`task-${startIndex + 2}`, 'IMPLEMENTATION', 'Implement Solution', 'Write code according to architecture plan', AgentType.FORGE, [AgentCapability.FILE_CREATION, AgentCapability.CODE_MODIFICATION, AgentCapability.DEPENDENCY_MANAGEMENT], [PermissionScope.FILESYSTEM_WORKSPACE_WRITE, PermissionScope.GIT_BRANCH, PermissionScope.GIT_COMMIT], 'MEDIUM'),
        this.createTask(`task-${startIndex + 3}`, 'BUILD_TEST', 'Build and Test', 'Compile code and run test suite', AgentType.FORGE, [AgentCapability.BUILD_EXECUTION, AgentCapability.UNIT_TESTING, AgentCapability.INTEGRATION_TESTING], [PermissionScope.SANDBOX_EXECUTE], 'LOW'),
        this.createTask(`task-${startIndex + 4}`, 'CODE_REVIEW', 'Code Review', 'Review implementation for quality and correctness', AgentType.FORGE, [AgentCapability.CODE_REVIEW], [PermissionScope.FILESYSTEM_READ], 'LOW'),
        this.createTask(`task-${startIndex + 5}`, 'GIT_CHECKPOINT', 'Create Git Checkpoint', 'Commit changes and create reviewable diff', AgentType.FORGE, [AgentCapability.GIT_CHECKPOINT, AgentCapability.DIFF_GENERATION], [PermissionScope.GIT_COMMIT, PermissionScope.GIT_PUSH], 'MEDIUM')
      );
    }

    if (goal.title === 'Security Analysis & Verification') {
      tasks.push(
        this.createTask(`task-${startIndex}`, 'THREAT_MODELING', 'Generate Threat Model', 'Create threat model for the application', AgentType.SENTINEL, [AgentCapability.THREAT_MODELING], [PermissionScope.FILESYSTEM_READ], 'LOW'),
        this.createTask(`task-${startIndex + 1}`, 'STATIC_ANALYSIS', 'Static Security Analysis', 'Run SAST and dependency scanning', AgentType.SENTINEL, [AgentCapability.STATIC_ANALYSIS, AgentCapability.DEPENDENCY_ANALYSIS, AgentCapability.SECRET_DETECTION], [PermissionScope.FILESYSTEM_READ, PermissionScope.SANDBOX_EXECUTE], 'LOW'),
        this.createTask(`task-${startIndex + 2}`, 'SECURITY_REVIEW', 'Security Control Review', 'Review auth, authz, API security, and config', AgentType.SENTINEL, [AgentCapability.AUTH_REVIEW, AgentCapability.AUTHZ_REVIEW, AgentCapability.API_SECURITY_REVIEW, AgentCapability.CONFIG_SECURITY_REVIEW], [PermissionScope.FILESYSTEM_READ], 'LOW'),
        this.createTask(`task-${startIndex + 3}`, 'FINDING_REPORT', 'Generate Security Report', 'Normalize findings and create auditable report', AgentType.SENTINEL, [AgentCapability.FINDING_NORMALIZATION, AgentCapability.SEVERITY_CLASSIFICATION, AgentCapability.SECURITY_REPORTING], [PermissionScope.FILESYSTEM_READ], 'LOW')
      );
    }

    if (goal.title === 'Research & Knowledge Gathering') {
      tasks.push(
        this.createTask(`task-${startIndex}`, 'TECH_RESEARCH', 'Technical Research', 'Research required technologies and patterns', AgentType.RESEARCH, [AgentCapability.WEB_RESEARCH, AgentCapability.DOCUMENTATION_RETRIEVAL, AgentCapability.REPOSITORY_RESEARCH], [PermissionScope.NETWORK_HTTP_ALLOWLISTED], 'LOW'),
        this.createTask(`task-${startIndex + 1}`, 'EVIDENCE_SYNTHESIS', 'Synthesize Evidence', 'Compile and validate research findings', AgentType.RESEARCH, [AgentCapability.DOCUMENT_ANALYSIS, AgentCapability.FACT_VERIFICATION, AgentCapability.EVIDENCE_SYNTHESIS], [PermissionScope.FILESYSTEM_READ], 'LOW')
      );
    }

    if (goal.title === 'Deployment & Operations') {
      tasks.push(
        this.createTask(`task-${startIndex}`, 'DEPLOYMENT_PREP', 'Prepare Deployment', 'Configure deployment artifacts and environment', AgentType.AUTOMATION, [AgentCapability.DEPLOYMENT, AgentCapability.CLOUD_OPERATIONS], [PermissionScope.DEPLOYMENT_STAGING], 'HIGH', true),
        this.createTask(`task-${startIndex + 1}`, 'DEPLOY', 'Execute Deployment', 'Deploy to target environment', AgentType.AUTOMATION, [AgentCapability.DEPLOYMENT, AgentCapability.SERVICE_MANAGEMENT], [PermissionScope.DEPLOYMENT_STAGING, PermissionScope.DEPLOYMENT_PRODUCTION], 'HIGH', true),
        this.createTask(`task-${startIndex + 2}`, 'MONITORING_SETUP', 'Configure Monitoring', 'Set up monitoring and alerting', AgentType.AUTOMATION, [AgentCapability.MONITORING, AgentCapability.SCHEDULED_WORKFLOWS], [PermissionScope.CLOUD_OPERATIONS], 'MEDIUM')
      );
    }

    return tasks;
  }

  private createTask(
    id: string,
    type: string,
    title: string,
    description: string,
    assignedAgent: AgentType,
    capabilities: AgentCapability[],
    requiredPermissions: PermissionScope[],
    riskLevel: RiskLevel,
    requiresApproval: boolean = false
  ): Task {
    return {
      id,
      milestoneId: '',
      type,
      title,
      description,
      assignedAgent,
      capabilities,
      dependencies: [],
      status: TaskStatus.CREATED,
      requiredPermissions,
      requiresApproval,
      riskLevel,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private addDependencies(tasks: Task[], intentResult: any): void {
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (let i = 1; i < tasks.length; i++) {
      const current = tasks[i];
      const previous = tasks[i - 1];

      if (current.assignedAgent === previous.assignedAgent) {
        current.dependencies.push(previous.id);
      } else if (current.assignedAgent === AgentType.SENTINEL && previous.assignedAgent === AgentType.FORGE) {
        current.dependencies.push(previous.id);
      } else if (current.assignedAgent === AgentType.AUTOMATION) {
        const forgeTasks = tasks.filter(t => t.assignedAgent === AgentType.FORGE);
        const sentinelTasks = tasks.filter(t => t.assignedAgent === AgentType.SENTINEL);
        current.dependencies.push(...forgeTasks.map(t => t.id));
        current.dependencies.push(...sentinelTasks.map(t => t.id));
      }
    }
  }

  private estimateDuration(tasks: Task[]): number {
    const baseMinutes = {
      LOW: 5,
      MEDIUM: 15,
      HIGH: 30
    };

    return tasks.reduce((sum, task) => sum + (baseMinutes[task.riskLevel] || 10), 0);
  }

  private assessRisk(tasks: Task[]): RiskLevel {
    const riskOrder: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const maxRisk = tasks.reduce((max, task) => Math.max(max, riskOrder[task.riskLevel]), 0);
    return (Object.keys(riskOrder).find(k => riskOrder[k as RiskLevel] === maxRisk) || 'LOW') as RiskLevel;
  }

  private identifyRequiredApprovals(tasks: Task[]): string[] {
    return tasks
      .filter(t => t.requiresApproval || t.riskLevel === 'HIGH')
      .map(t => `${t.type}_approval`);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';