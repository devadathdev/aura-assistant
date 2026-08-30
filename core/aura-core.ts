import { Mission, Task, TaskStatus, MissionStatus, AgentType, SecurityFinding, FindingStatus, ApprovalRequest, ApprovalStatus, ToolRequest, ToolExecution, GovernanceDecision, AgentCapability, PermissionScope } from '../shared/types';
import { IntentService } from '../core/intent/intent-service';
import { PlannerService } from '../core/planner/planner-service';
import { MissionService } from '../core/missions/mission-service';
import { AgentRouter } from '../core/routing/agent-router';
import { ContextManager } from '../core/context/context-manager';
import { ModelRouter } from '../core/models/model-router';
import { GovernanceEngine } from '../governance/governance-engine';
import { ToolBroker } from '../tools/tool-broker';
import { createForgeAdapter } from '../agents/forge/forge-adapter';
import { createSentinelAdapter } from '../agents/sentinel/sentinel-adapter';
import { WikipediaExecutor } from '../tools/tool-broker';

export class AuraCore {
  private intentService: IntentService;
  private plannerService: PlannerService;
  private missionService: MissionService;
  private agentRouter: AgentRouter;
  private contextManager: ContextManager;
  private modelRouter: ModelRouter;
  private governanceEngine: GovernanceEngine;
  private toolBroker: ToolBroker;
  private forgeAdapter: any;
  private sentinelAdapter: any;

  constructor() {
    this.contextManager = new ContextManager();
    this.modelRouter = new ModelRouter();
    this.governanceEngine = new GovernanceEngine();
    this.toolBroker = new ToolBroker(this.governanceEngine);
    this.intentService = new IntentService(this.modelRouter);
    this.plannerService = new PlannerService(this.intentService);
    this.missionService = new MissionService(
      new InMemoryMissionStore(),
      new InMemoryTaskStore(),
      null
    );
    this.agentRouter = new AgentRouter(new InMemoryAgentRegistry());

    this.forgeAdapter = createForgeAdapter(this.toolBroker, this.modelRouter, this.contextManager);
    this.sentinelAdapter = createSentinelAdapter(this.toolBroker, this.modelRouter, this.contextManager);

    this.agentRouter.registerAgent(this.forgeAdapter);
    this.agentRouter.registerAgent(this.sentinelAdapter);

    this.registerToolExecutors();
  }

  private registerToolExecutors(): void {
    this.toolBroker.registerExecutor(new SandboxExecutor());
    this.toolBroker.registerExecutor(new FileSystemExecutor());
    this.toolBroker.registerExecutor(new GitExecutor());
    this.toolBroker.registerExecutor(new NetworkExecutor());
    this.toolBroker.registerExecutor(new SecretExecutor());
    this.toolBroker.registerExecutor(new DeploymentExecutor());
    this.toolBroker.registerExecutor(new WikipediaExecutor());
  }

  async processUserRequest(request: string, projectId?: string): Promise<Mission> {
    const mission = await this.missionService.createMission(request, projectId);
    
    const intentResult = await this.intentService.analyzeRequest(request, { projectId });
    this.contextManager.setUserContext({ lastRequest: request, intent: intentResult });

    const plan = await this.plannerService.createPlan(mission, intentResult);
    
    await this.missionService.addGoals(mission.id, plan.goals);
    const tasks = await this.missionService.addTasks(mission.id, plan.tasks);

    await this.missionService.updateMissionStatus(mission.id, MissionStatus.PLANNING);

    for (const task of tasks) {
      task.missionId = mission.id;
    }

    await this.executeMission(mission.id);
    return this.missionService.getMission(mission.id) as Promise<Mission>;
  }

  async executeMission(missionId: string): Promise<void> {
    await this.missionService.updateMissionStatus(missionId, MissionStatus.RUNNING);

    let running = true;
    while (running) {
      const runnableTasks = await this.missionService.getRunnableTasks(missionId);
      
      if (runnableTasks.length === 0) {
        const mission = await this.missionService.getMission(missionId);
        const allTasks = await this.missionService['taskStore'].findByMissionId(missionId);
        const allCompleted = allTasks.every(t => t.status === TaskStatus.COMPLETED);
        const anyFailed = allTasks.some(t => t.status === TaskStatus.FAILED);
        
        if (allCompleted) {
          await this.missionService.updateMissionStatus(missionId, MissionStatus.COMPLETED);
        } else if (anyFailed) {
          await this.missionService.updateMissionStatus(missionId, MissionStatus.FAILED);
        } else {
          await this.missionService.updateMissionStatus(missionId, MissionStatus.BLOCKED);
        }
        running = false;
        continue;
      }

      for (const task of runnableTasks) {
        await this.executeTask(missionId, task);
      }
    }
  }

  async executeTask(missionId: string, task: Task): Promise<void> {
    await this.missionService.updateTaskStatus(task.id, TaskStatus.ANALYZING);

    const agent = await this.agentRouter.routeTask(task, await this.missionService.getMission(missionId) as Mission);
    if (!agent) {
      await this.missionService.updateTaskStatus(task.id, TaskStatus.FAILED, null, 'No available agent');
      return;
    }

    this.agentRouter.updateAgentStatus(agent.id, 'BUSY');

    try {
      let result: any;

      if (agent.type === AgentType.FORGE) {
        result = await this.forgeAdapter.executeForgeTask(task, await this.missionService.getMission(missionId) as Mission);
      } else if (agent.type === AgentType.SENTINEL) {
        result = await this.sentinelAdapter.executeSentinelTask(task, await this.missionService.getMission(missionId) as Mission);
      } else {
        result = { message: `Agent type ${agent.type} not implemented` };
      }

      if (task.type === 'STATIC_ANALYSIS' || task.type === 'DEPENDENCY_ANALYSIS' || task.type === 'SECRET_DETECTION' || task.type === 'SECURITY_REVIEW') {
        const findings = result.findings || [];
        for (const finding of findings) {
          const securityFinding = this.forgeAdapter.createSecurityFinding({
            missionId,
            taskId: task.id,
            findingId: finding.id || `finding-${Date.now()}`,
            severity: finding.severity,
            category: finding.category,
            component: finding.component,
            location: finding.location,
            description: finding.description,
            evidence: finding.evidence,
            confidence: finding.confidence || 0.8,
            recommendation: finding.recommendation,
            status: FindingStatus.NEW
          });
          await this.missionService.recordSecurityFinding(securityFinding);
        }
      }

      await this.missionService.updateTaskStatus(task.id, TaskStatus.COMPLETED, result);
    } catch (error) {
      await this.missionService.updateTaskStatus(task.id, TaskStatus.FAILED, null, String(error));
    } finally {
      this.agentRouter.updateAgentStatus(agent.id, 'IDLE');
    }
  }

  async handleForgeSentinelRemediation(missionId: string, findingId: string): Promise<void> {
    const mission = await this.missionService.getMission(missionId);
    if (!mission) return;

    const securityTask = mission.goals
      .flatMap(g => g.milestones)
      .flatMap(m => m.tasks)
      .find(t => t.type === 'SECURITY_REVIEW' || t.type === 'FINDING_REPORT');

    if (!securityTask) return;

    const finding = {
      id: findingId,
      missionId,
      taskId: securityTask.id,
      findingId,
      severity: FindingSeverity.HIGH,
      category: 'REMEDIATION',
      component: 'UNKNOWN',
      description: 'Remediation verification',
      evidence: 'FORGE patch applied',
      confidence: 0.9,
      recommendation: 'Verify fix',
      status: FindingStatus.IN_PROGRESS,
      verificationState: 'UNVERIFIED' as any,
      detectedBy: AgentType.FORGE,
      createdAt: new Date(),
      updatedAt: new Date()
    } as SecurityFinding;

    const verification = await this.sentinelAdapter.verifyFinding(finding, {});
    
    if (verification.verificationState === 'REOPENED') {
      const remediationTask: Task = {
        id: `remediation-${Date.now()}`,
        milestoneId: securityTask.milestoneId,
        type: 'REMEDIATION',
        title: `Fix security finding ${findingId}`,
        description: `Apply fix for ${verification.remainingConcerns?.join(', ')}`,
        assignedAgent: AgentType.FORGE,
        capabilities: [AgentCapability.PATCH_GENERATION, AgentCapability.FAILURE_ANALYSIS],
        dependencies: [],
        status: TaskStatus.CREATED,
        requiredPermissions: [PermissionScope.FILESYSTEM_WORKSPACE_WRITE, PermissionScope.GIT_COMMIT],
        requiresApproval: false,
        riskLevel: 'MEDIUM',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.missionService.addTasks(missionId, [remediationTask]);
    }
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalRequest> {
    return this.missionService.requestApproval(request);
  }

  async resolveApproval(approvalId: string, approved: boolean, resolvedBy: string, response?: unknown): Promise<void> {
    await this.missionService.resolveApproval(approvalId, approved, resolvedBy, response);
    await this.governanceEngine.resolveApproval(approvalId, approved, response);
  }

  getMissionService(): MissionService {
    return this.missionService;
  }

  getGovernanceEngine(): GovernanceEngine {
    return this.governanceEngine;
  }

  getToolBroker(): ToolBroker {
    return this.toolBroker;
  }
}

class InMemoryMissionStore {
  private missions: Map<string, Mission> = new Map();

  async create(mission: Mission): Promise<Mission> {
    this.missions.set(mission.id, mission);
    return mission;
  }

  async findById(id: string): Promise<Mission | null> {
    return this.missions.get(id) || null;
  }

  async update(mission: Mission): Promise<Mission> {
    this.missions.set(mission.id, mission);
    return mission;
  }

  async findAll(): Promise<Mission[]> {
    return Array.from(this.missions.values());
  }

  async findByStatus(status: MissionStatus): Promise<Mission[]> {
    return Array.from(this.missions.values()).filter(m => m.status === status);
  }
}

class InMemoryTaskStore {
  private tasks: Map<string, Task> = new Map();

  async create(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async findByMissionId(missionId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => (t as any).missionId === missionId);
  }

  async update(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return task;
  }

  async findRunnable(missionId: string): Promise<Task[]> {
    const tasks = await this.findByMissionId(missionId);
    return tasks.filter(t => t.status === TaskStatus.CREATED && this.areDependenciesMet(t, tasks));
  }

  private areDependenciesMet(task: Task, allTasks: Task[]): boolean {
    return task.dependencies.every(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return dep && dep.status === TaskStatus.COMPLETED;
    });
  }
}

class InMemoryAgentRegistry {
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

class SandboxExecutor {
  supportsTool(tool: string): boolean {
    return ['run_command', 'run_tests', 'run_build', 'run_linter', 'run_typecheck', 'install_dependencies'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return { stdout: '', stderr: '', exitCode: 0 };
  }
}

class FileSystemExecutor {
  supportsTool(tool: string): boolean {
    return ['read_file', 'write_file', 'delete_file', 'search_files', 'list_directory'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return {};
  }
}

class GitExecutor {
  supportsTool(tool: string): boolean {
    return ['git_status', 'git_diff', 'git_create_branch', 'git_commit', 'git_push', 'github_create_pr', 'github_merge_pr'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true };
  }
}

class NetworkExecutor {
  supportsTool(tool: string): boolean {
    return ['fetch', 'http_request'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return { status: 200, data: {} };
  }
}

class SecretExecutor {
  supportsTool(tool: string): boolean {
    return ['get_secret', 'set_secret', 'rotate_secret'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true };
  }
}

class DeploymentExecutor {
  supportsTool(tool: string): boolean {
    return ['deploy_staging', 'deploy_production', 'service_start', 'service_stop', 'service_restart'].includes(tool);
  }
  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true, deploymentId: `deploy-${Date.now()}` };
  }
}