import { Agent, AgentType, AgentCapability, Task, TaskStatus, Mission, SecurityFinding, FindingSeverity, FindingStatus, ToolRequest, PermissionScope } from '../shared/types';
import { ToolBroker } from '../tools/tool-broker';
import { ModelRouter } from '../core/models/model-router';
import { ContextManager } from '../core/context/context-manager';

export interface ForgeAgentAdapter extends Agent {
  executeForgeTask(task: Task, mission: Mission): Promise<any>;
  createSecurityFinding(finding: Omit<SecurityFinding, 'id' | 'missionId' | 'detectedBy' | 'createdAt' | 'updatedAt'>): SecurityFinding;
}

export function createForgeAdapter(
  toolBroker: ToolBroker,
  modelRouter: ModelRouter,
  contextManager: ContextManager
): ForgeAgentAdapter {
  const capabilities: AgentCapability[] = [
    AgentCapability.REPOSITORY_INSPECTION,
    AgentCapability.ARCHITECTURE_PLANNING,
    AgentCapability.FILE_CREATION,
    AgentCapability.CODE_MODIFICATION,
    AgentCapability.DEPENDENCY_MANAGEMENT,
    AgentCapability.BUILD_EXECUTION,
    AgentCapability.UNIT_TESTING,
    AgentCapability.INTEGRATION_TESTING,
    AgentCapability.FAILURE_ANALYSIS,
    AgentCapability.PATCH_GENERATION,
    AgentCapability.CODE_REVIEW,
    AgentCapability.GIT_CHECKPOINT,
    AgentCapability.DIFF_GENERATION,
    AgentCapability.ROLLBACK,
    AgentCapability.BUILD_ARTIFACTS
  ];

  const adapter: ForgeAgentAdapter = {
    id: 'forge-adapter',
    type: AgentType.FORGE,
    name: 'FORGE Engineering Agent',
    capabilities,
    status: 'IDLE',
    health: 100,
    lastHeartbeat: new Date(),

    async executeForgeTask(task: Task, mission: Mission): Promise<any> {
      adapter.status = 'BUSY';
      adapter.lastHeartbeat = new Date();

      try {
        const taskContext = contextManager.getContextForTask(task.id);
        taskContext.mission = { id: mission.id, objective: mission.objective };
        taskContext.task = { id: task.id, type: task.type, title: task.title };

        let result: any;

        switch (task.type) {
          case 'REPOSITORY_INSPECTION':
            result = await executeRepositoryInspection(task, mission, toolBroker, modelRouter);
            break;
          case 'ARCHITECTURE_PLANNING':
            result = await executeArchitecturePlanning(task, mission, toolBroker, modelRouter);
            break;
          case 'IMPLEMENTATION':
            result = await executeImplementation(task, mission, toolBroker, modelRouter);
            break;
          case 'BUILD_TEST':
            result = await executeBuildAndTest(task, mission, toolBroker);
            break;
          case 'CODE_REVIEW':
            result = await executeCodeReview(task, mission, toolBroker, modelRouter);
            break;
          case 'GIT_CHECKPOINT':
            result = await executeGitCheckpoint(task, mission, toolBroker);
            break;
          default:
            result = { message: `Task type ${task.type} not implemented yet` };
        }

        adapter.status = 'IDLE';
        adapter.health = 100;
        return result;
      } catch (error) {
        adapter.status = 'ERROR';
        adapter.health = 50;
        throw error;
      }
    },

    createSecurityFinding(findingData): SecurityFinding {
      return {
        id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        missionId: findingData.missionId,
        taskId: findingData.taskId,
        findingId: findingData.findingId,
        severity: findingData.severity,
        category: findingData.category,
        component: findingData.component,
        location: findingData.location,
        description: findingData.description,
        evidence: findingData.evidence,
        confidence: findingData.confidence,
        recommendation: findingData.recommendation,
        status: findingData.status,
        verificationState: 'UNVERIFIED',
        detectedBy: AgentType.FORGE,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  };

  return adapter;
}

async function executeRepositoryInspection(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const request: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'list_directory',
    capability: PermissionScope.FILESYSTEM_READ,
    parameters: { path: '/workspace' },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const result = await toolBroker.execute(request);
  return { inspection: result.result, summary: 'Repository structure analyzed' };
}

async function executeArchitecturePlanning(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const prompt = `Create an architecture plan for: ${mission.objective}

Task: ${task.description}

Generate a detailed implementation plan with:
1. File structure
2. Key components
3. Dependencies
4. API design
5. Database schema (if applicable)
6. Security considerations
7. Test strategy
8. Risk assessment`;

  const plan = await modelRouter.generate('architecture_planning', prompt, { temperature: 0.3, maxTokens: 4000 });
  return { plan, summary: 'Architecture plan created' };
}

async function executeImplementation(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const files = await generateImplementationFiles(mission, task, modelRouter);
  const results = [];

  for (const file of files) {
    const request: ToolRequest = {
      id: `req-${Date.now()}`,
      missionId: mission.id,
      taskId: task.id,
      agentId: 'forge-adapter',
      tool: 'write_file',
      capability: PermissionScope.FILESYSTEM_WORKSPACE_WRITE,
      parameters: { path: file.path, content: file.content },
      workspace: '/workspace',
      timeout: 30000,
      timestamp: new Date()
    };
    results.push(await toolBroker.execute(request));
  }

  return { filesCreated: files.length, results, summary: `Implemented ${files.length} files` };
}

async function executeBuildAndTest(task: Task, mission: Mission, toolBroker: ToolBroker): Promise<any> {
  const buildRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'run_build',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'npm', args: ['run', 'build'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 120000,
    timestamp: new Date()
  };

  const buildResult = await toolBroker.execute(buildRequest);

  const testRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'run_tests',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'npm', args: ['test'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 120000,
    timestamp: new Date()
  };

  const testResult = await toolBroker.execute(testRequest);

  return {
    build: buildResult.result,
    test: testResult.result,
    summary: 'Build and test completed'
  };
}

async function executeCodeReview(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const diffRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'git_diff',
    capability: PermissionScope.FILESYSTEM_READ,
    parameters: { base: 'main', head: 'HEAD' },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const diffResult = await toolBroker.execute(diffRequest);

  const prompt = `Review the following code changes for quality, correctness, and security:

${JSON.stringify(diffResult.result, null, 2)}

Provide a review with:
1. Overall assessment
2. Critical issues
3. Suggestions for improvement
4. Security concerns
5. Approval recommendation (APPROVED/CHANGES_REQUIRED/BLOCKED)`;

  const review = await modelRouter.generate('code_review', prompt, { temperature: 0.2, maxTokens: 3000 });
  return { review, diff: diffResult.result, summary: 'Code review completed' };
}

async function executeGitCheckpoint(task: Task, mission: Mission, toolBroker: ToolBroker): Promise<any> {
  const commitRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'git_commit',
    capability: PermissionScope.GIT_COMMIT,
    parameters: { message: `AURA Mission ${mission.id}: ${task.title}`, addAll: true },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const commitResult = await toolBroker.execute(commitRequest);

  const pushRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'forge-adapter',
    tool: 'git_push',
    capability: PermissionScope.GIT_PUSH,
    parameters: { remote: 'origin', branch: 'mission-branch' },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const pushResult = await toolBroker.execute(pushRequest);

  return { commit: commitResult.result, push: pushResult.result, summary: 'Git checkpoint created' };
}

async function generateImplementationFiles(mission: Mission, task: Task, modelRouter: ModelRouter): Promise<Array<{ path: string; content: string }>> {
  const prompt = `Generate the implementation files for this task:

Mission: ${mission.objective}
Task: ${task.title}
Description: ${task.description}

Return a JSON array of files with path and content:
[{"path": "file.ts", "content": "// code here"}]`;

  const response = await modelRouter.generate('file_generation', prompt, { temperature: 0.3, maxTokens: 8000 });
  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
}