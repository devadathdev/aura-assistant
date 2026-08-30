import { SecurityFinding, FindingSeverity, FindingStatus, AgentType, Task, TaskStatus, Mission, PermissionScope, AgentCapability } from '../shared/types';
import { createForgeAdapter } from '../agents/forge/forge-adapter';
import { createSentinelAdapter } from '../agents/sentinel/sentinel-adapter';
import { ToolBroker } from '../tools/tool-broker';
import { ModelRouter } from '../core/models/model-router';
import { ContextManager } from '../core/context/context-manager';
import { MissionService } from '../core/missions/mission-service';

export interface RemediationCycle {
  id: string;
  missionId: string;
  findingId: string;
  status: 'PENDING' | 'FORGE_PATCHING' | 'SENTINEL_VERIFYING' | 'VERIFIED' | 'REOPENED' | 'FAILED';
  forgePatch?: any;
  verificationResult?: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ForgeSentinelRemediationProtocol {
  private missionService: MissionService;
  private toolBroker: ToolBroker;
  private modelRouter: ModelRouter;
  private contextManager: ContextManager;
  private forgeAdapter: any;
  private sentinelAdapter: any;
  private cycles: Map<string, RemediationCycle> = new Map();

  constructor(
    missionService: MissionService,
    toolBroker: ToolBroker,
    modelRouter: ModelRouter,
    contextManager: ContextManager
  ) {
    this.missionService = missionService;
    this.toolBroker = toolBroker;
    this.modelRouter = modelRouter;
    this.contextManager = contextManager;
    this.forgeAdapter = createForgeAdapter(toolBroker, modelRouter, contextManager);
    this.sentinelAdapter = createSentinelAdapter(toolBroker, modelRouter, contextManager);
  }

  async initiateRemediation(missionId: string, findingId: string): Promise<RemediationCycle> {
    const cycle: RemediationCycle = {
      id: `remediation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      missionId,
      findingId,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.cycles.set(cycle.id, cycle);
    await this.executeRemediationCycle(cycle);
    return cycle;
  }

  private async executeRemediationCycle(cycle: RemediationCycle): Promise<void> {
    const mission = await this.missionService.getMission(cycle.missionId);
    if (!mission) {
      cycle.status = 'FAILED';
      cycle.updatedAt = new Date();
      return;
    }

    const finding = this.findFinding(cycle.missionId, cycle.findingId);
    if (!finding) {
      cycle.status = 'FAILED';
      cycle.updatedAt = new Date();
      return;
    }

    while (cycle.attempts < cycle.maxAttempts) {
      cycle.attempts++;
      cycle.updatedAt = new Date();

      // Phase 1: FORGE creates patch
      cycle.status = 'FORGE_PATCHING';
      const patch = await this.forgeCreatePatch(mission, finding, cycle);
      cycle.forgePatch = patch;

      if (!patch || patch.error) {
        cycle.status = 'FAILED';
        cycle.updatedAt = new Date();
        return;
      }

      // Phase 2: FORGE applies patch and tests
      const testResult = await this.forgeApplyAndTest(mission, finding, patch);
      if (!testResult.success) {
        continue; // Retry with failure context
      }

      // Phase 3: SENTINEL independently verifies
      cycle.status = 'SENTINEL_VERIFYING';
      const verification = await this.sentinelAdapter.verifyFinding(finding, patch);
      cycle.verificationResult = verification;

      if (verification.verificationState === 'VERIFIED') {
        cycle.status = 'VERIFIED';
        finding.status = FindingStatus.VERIFIED;
        finding.verificationState = 'VERIFIED';
        finding.verifiedBy = AgentType.SENTINEL;
        finding.updatedAt = new Date();
        cycle.updatedAt = new Date();
        return;
      } else {
        // REOPENED - add remaining concerns to finding for next iteration
        finding.status = FindingStatus.REOPENED;
        finding.verificationState = 'REOPENED';
        finding.description += `\n\n[Remediation Attempt ${cycle.attempts}] Remaining concerns: ${verification.remainingConcerns?.join(', ')}`;
        finding.updatedAt = new Date();
        cycle.status = 'REOPENED';
      }
    }

    cycle.status = 'FAILED';
    cycle.updatedAt = new Date();
  }

  private async forgeCreatePatch(mission: Mission, finding: SecurityFinding, cycle: RemediationCycle): Promise<any> {
    const prompt = `Create a security patch for the following finding:

FINDING:
- ID: ${finding.findingId}
- Severity: ${finding.severity}
- Category: ${finding.category}
- Component: ${finding.component}
- Location: ${finding.location?.file}:${finding.location?.line || 'N/A'}
- Description: ${finding.description}
- Evidence: ${finding.evidence}
- Recommendation: ${finding.recommendation}

MISSION OBJECTIVE: ${mission.objective}

Previous attempts: ${cycle.attempts}
${cycle.forgePatch ? `Previous patch: ${JSON.stringify(cycle.forgePatch)}` : ''}
${cycle.verificationResult ? `Verification feedback: ${JSON.stringify(cycle.verificationResult)}` : ''}

Generate a focused patch that:
1. Addresses the root cause
2. Follows secure coding practices
3. Does not introduce new vulnerabilities
4. Includes test cases to verify the fix

Return JSON:
{
  "files": [{"path": "file.ts", "content": "// fixed code", "action": "MODIFY"}],
  "tests": [{"path": "test.ts", "content": "// test code"}],
  "explanation": "What was fixed and why"
}`;

    const response = await this.modelRouter.generate('security_patch', prompt, { temperature: 0.1, maxTokens: 6000 });
    try {
      return JSON.parse(response);
    } catch {
      return { error: 'Failed to parse patch response', raw: response };
    }
  }

  private async forgeApplyAndTest(mission: Mission, finding: SecurityFinding, patch: any): Promise<{ success: boolean; result?: any }> {
    try {
      for (const file of patch.files || []) {
        const request = {
          id: `req-${Date.now()}`,
          missionId: mission.id,
          taskId: `remediation-${cycle.id}`,
          agentId: 'forge-adapter',
          tool: 'write_file',
          capability: PermissionScope.FILESYSTEM_WORKSPACE_WRITE,
          parameters: { path: file.path, content: file.content },
          workspace: '/workspace',
          timeout: 30000,
          timestamp: new Date()
        };
        await this.toolBroker.execute(request);
      }

      for (const test of patch.tests || []) {
        const request = {
          id: `req-${Date.now()}`,
          missionId: mission.id,
          taskId: `remediation-${cycle.id}`,
          agentId: 'forge-adapter',
          tool: 'write_file',
          capability: PermissionScope.FILESYSTEM_WORKSPACE_WRITE,
          parameters: { path: test.path, content: test.content },
          workspace: '/workspace',
          timeout: 30000,
          timestamp: new Date()
        };
        await this.toolBroker.execute(request);
      }

      const testRequest = {
        id: `req-${Date.now()}`,
        missionId: mission.id,
        taskId: `remediation-${cycle.id}`,
        agentId: 'forge-adapter',
        tool: 'run_tests',
        capability: PermissionScope.SANDBOX_EXECUTE,
        parameters: { command: 'npm', args: ['test'], cwd: '/workspace' },
        workspace: '/workspace',
        timeout: 120000,
        timestamp: new Date()
      };

      const testResult = await this.toolBroker.execute(testRequest);
      return { success: testResult.result?.exitCode === 0, result: testResult.result };
    } catch (error) {
      return { success: false, result: { error: String(error) } };
    }
  }

  private findFinding(missionId: string, findingId: string): SecurityFinding | null {
    // This would query the actual findings store
    return null;
  }

  getCycle(cycleId: string): RemediationCycle | undefined {
    return this.cycles.get(cycleId);
  }

  getCyclesForMission(missionId: string): RemediationCycle[] {
    return Array.from(this.cycles.values()).filter(c => c.missionId === missionId);
  }

  getCyclesForFinding(findingId: string): RemediationCycle[] {
    return Array.from(this.cycles.values()).filter(c => c.findingId === findingId);
  }
}