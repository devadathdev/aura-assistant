import { GovernanceDecision, PermissionScope, ToolRequest, ToolExecution, AgentType } from '../shared/types';

export interface PolicyRule {
  id: string;
  name: string;
  agentTypes: AgentType[];
  tools: string[];
  capabilities: PermissionScope[];
  riskLevels: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
  decision: GovernanceDecision;
  conditions?: Record<string, unknown>;
  priority: number;
}

export interface GovernanceContext {
  missionId: string;
  taskId: string;
  agentId: string;
  agentType: AgentType;
  tool: string;
  capability: PermissionScope;
  parameters: Record<string, unknown>;
  workspace: string;
}

export class GovernanceEngine {
  private policies: PolicyRule[] = [];
  private approvalCallbacks: Map<string, (approved: boolean, response?: unknown) => void> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    this.policies = [
      {
        id: 'read-only-allow',
        name: 'Read-only operations allowed',
        agentTypes: [AgentType.FORGE, AgentType.SENTINEL, AgentType.RESEARCH, AgentType.AUTOMATION],
        tools: ['read_file', 'search_files', 'list_directory', 'git_status', 'git_diff'],
        capabilities: [PermissionScope.FILESYSTEM_READ, PermissionScope.GIT_COMMIT],
        riskLevels: ['LOW'],
        decision: GovernanceDecision.ALLOW,
        priority: 100
      },
      {
        id: 'forge-write-allow',
        name: 'FORGE workspace writes allowed',
        agentTypes: [AgentType.FORGE],
        tools: ['write_file', 'delete_file'],
        capabilities: [PermissionScope.FILESYSTEM_WORKSPACE_WRITE],
        riskLevels: ['MEDIUM'],
        decision: GovernanceDecision.ALLOW,
        priority: 90
      },
      {
        id: 'forge-git-allow',
        name: 'FORGE git operations allowed',
        agentTypes: [AgentType.FORGE],
        tools: ['git_create_branch', 'git_commit', 'git_push', 'github_create_pr'],
        capabilities: [PermissionScope.GIT_BRANCH, PermissionScope.GIT_COMMIT, PermissionScope.GIT_PUSH],
        riskLevels: ['MEDIUM'],
        decision: GovernanceDecision.ALLOW,
        priority: 90
      },
      {
        id: 'sentinel-scan-allow',
        name: 'SENTINEL security scans allowed',
        agentTypes: [AgentType.SENTINEL],
        tools: ['run_command', 'run_tests', 'run_build', 'run_linter', 'run_typecheck'],
        capabilities: [PermissionScope.SANDBOX_EXECUTE],
        riskLevels: ['LOW', 'MEDIUM'],
        decision: GovernanceDecision.ALLOW,
        priority: 90
      },
      {
        id: 'high-risk-approval',
        name: 'High-risk operations require approval',
        agentTypes: [AgentType.FORGE, AgentType.SENTINEL, AgentType.RESEARCH, AgentType.AUTOMATION],
        tools: ['github_merge_pr', 'deploy_production', 'delete_data', 'rotate_credentials'],
        capabilities: [PermissionScope.DEPLOYMENT_PRODUCTION, PermissionScope.SECRETS_REQUEST],
        riskLevels: ['HIGH', 'CRITICAL'],
        decision: GovernanceDecision.REQUIRE_APPROVAL,
        priority: 80
      },
      {
        id: 'automation-restricted',
        name: 'AUTOMATION restricted to sandbox',
        agentTypes: [AgentType.AUTOMATION],
        tools: ['*'],
        capabilities: ['*'],
        riskLevels: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        decision: GovernanceDecision.SANDBOX_ONLY,
        priority: 70
      },
      {
        id: 'network-restricted',
        name: 'Network access restricted to allowlist',
        agentTypes: [AgentType.FORGE, AgentType.SENTINEL, AgentType.RESEARCH, AgentType.AUTOMATION],
        tools: ['fetch', 'http_request'],
        capabilities: [PermissionScope.NETWORK_HTTP_ALLOWLISTED],
        riskLevels: ['LOW', 'MEDIUM'],
        decision: GovernanceDecision.ALLOW_WITH_LIMITS,
        conditions: { allowlist: ['api.github.com', 'registry.npmjs.org', 'pypi.org'] },
        priority: 85
      }
    ];
  }

  addPolicy(policy: PolicyRule): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  removePolicy(policyId: string): void {
    this.policies = this.policies.filter(p => p.id !== policyId);
  }

  async evaluate(request: ToolRequest): Promise<GovernanceDecision> {
    const context: GovernanceContext = {
      missionId: request.missionId,
      taskId: request.taskId,
      agentId: request.agentId,
      agentType: request.agentId as unknown as AgentType,
      tool: request.tool,
      capability: request.capability,
      parameters: request.parameters,
      workspace: request.workspace
    };

    for (const policy of this.policies) {
      if (this.matchesPolicy(policy, context)) {
        if (policy.decision === GovernanceDecision.REQUIRE_APPROVAL) {
          return await this.requestApproval(context, policy);
        }
        if (policy.decision === GovernanceDecision.ALLOW_WITH_LIMITS) {
          return this.checkLimits(policy, context) ? GovernanceDecision.ALLOW : GovernanceDecision.DENY;
        }
        return policy.decision;
      }
    }

    return GovernanceDecision.DENY;
  }

  private matchesPolicy(policy: PolicyRule, context: GovernanceContext): boolean {
    if (policy.agentTypes.length > 0 && !policy.agentTypes.includes(context.agentType)) {
      return false;
    }
    if (policy.tools.length > 0 && !policy.tools.includes('*') && !policy.tools.includes(context.tool)) {
      return false;
    }
    if (policy.capabilities.length > 0 && !policy.capabilities.includes('*') && !policy.capabilities.includes(context.capability)) {
      return false;
    }
    if (policy.conditions) {
      for (const [key, expected] of Object.entries(policy.conditions)) {
        if (key === 'allowlist' && Array.isArray(expected)) {
          const url = context.parameters.url as string;
          if (url && !expected.some((allowed: string) => url.includes(allowed))) {
            return false;
          }
        }
      }
    }
    return true;
  }

  private checkLimits(policy: PolicyRule, context: GovernanceContext): boolean {
    if (policy.conditions?.allowlist) {
      const url = context.parameters.url as string;
      if (url) {
        return policy.conditions.allowlist.some((allowed: string) => url.includes(allowed));
      }
    }
    return true;
  }

  private async requestApproval(context: GovernanceContext, policy: PolicyRule): Promise<GovernanceDecision> {
    return new Promise((resolve) => {
      const approvalId = `${context.missionId}-${context.taskId}-${Date.now()}`;
      this.approvalCallbacks.set(approvalId, (approved) => {
        this.approvalCallbacks.delete(approvalId);
        resolve(approved ? GovernanceDecision.ALLOW : GovernanceDecision.DENY);
      });
    });
  }

  async resolveApproval(approvalId: string, approved: boolean, response?: unknown): Promise<void> {
    const callback = this.approvalCallbacks.get(approvalId);
    if (callback) {
      callback(approved, response);
    }
  }

  getPolicies(): PolicyRule[] {
    return [...this.policies];
  }
}