import { Agent, AgentType, AgentCapability, Task, Mission, SecurityFinding, FindingSeverity, FindingStatus, ToolRequest, PermissionScope } from '../shared/types';
import { ToolBroker } from '../tools/tool-broker';
import { ModelRouter } from '../core/models/model-router';
import { ContextManager } from '../core/context/context-manager';

export interface SentinelAgentAdapter extends Agent {
  executeSentinelTask(task: Task, mission: Mission): Promise<any>;
  verifyFinding(finding: SecurityFinding, forgePatch: any): Promise<SecurityFinding>;
  generateSecurityReport(findings: SecurityFinding[], mission: Mission): Promise<any>;
}

export function createSentinelAdapter(
  toolBroker: ToolBroker,
  modelRouter: ModelRouter,
  contextManager: ContextManager
): SentinelAgentAdapter {
  const capabilities: AgentCapability[] = [
    AgentCapability.THREAT_MODELING,
    AgentCapability.STATIC_ANALYSIS,
    AgentCapability.DEPENDENCY_ANALYSIS,
    AgentCapability.SECRET_DETECTION,
    AgentCapability.AUTH_REVIEW,
    AgentCapability.AUTHZ_REVIEW,
    AgentCapability.API_SECURITY_REVIEW,
    AgentCapability.CONFIG_SECURITY_REVIEW,
    AgentCapability.FINDING_NORMALIZATION,
    AgentCapability.SEVERITY_CLASSIFICATION,
    AgentCapability.REMEDIATION_RECOMMENDATION,
    AgentCapability.INDEPENDENT_VERIFICATION,
    AgentCapability.BASELINE_VALIDATION,
    AgentCapability.SECURITY_REPORTING
  ];

  const adapter: SentinelAgentAdapter = {
    id: 'sentinel-adapter',
    type: AgentType.SENTINEL,
    name: 'SENTINEL Security Agent',
    capabilities,
    status: 'IDLE',
    health: 100,
    lastHeartbeat: new Date(),

    async executeSentinelTask(task: Task, mission: Mission): Promise<any> {
      adapter.status = 'BUSY';
      adapter.lastHeartbeat = new Date();

      try {
        const taskContext = contextManager.getContextForTask(task.id);
        taskContext.mission = { id: mission.id, objective: mission.objective };
        taskContext.task = { id: task.id, type: task.type, title: task.title };

        let result: any;

        switch (task.type) {
          case 'THREAT_MODELING':
            result = await executeThreatModeling(task, mission, toolBroker, modelRouter);
            break;
          case 'STATIC_ANALYSIS':
            result = await executeStaticAnalysis(task, mission, toolBroker);
            break;
          case 'DEPENDENCY_ANALYSIS':
            result = await executeDependencyAnalysis(task, mission, toolBroker);
            break;
          case 'SECRET_DETECTION':
            result = await executeSecretDetection(task, mission, toolBroker);
            break;
          case 'SECURITY_REVIEW':
            result = await executeSecurityReview(task, mission, toolBroker, modelRouter);
            break;
          case 'FINDING_REPORT':
            result = await executeFindingReport(task, mission, modelRouter);
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

    async verifyFinding(finding: SecurityFinding, forgePatch: any): Promise<SecurityFinding> {
      const verificationPrompt = `Verify if the following FORGE patch resolves the security finding:

FINDING:
- ID: ${finding.findingId}
- Severity: ${finding.severity}
- Category: ${finding.category}
- Component: ${finding.component}
- Location: ${finding.location?.file}:${finding.location?.line || 'N/A'}
- Description: ${finding.description}
- Evidence: ${finding.evidence}
- Recommendation: ${finding.recommendation}

FORGE PATCH:
${JSON.stringify(forgePatch, null, 2)}

Analyze whether the patch:
1. Addresses the root cause
2. Introduces no new vulnerabilities
3. Follows secure coding practices
4. Is complete and correct

Respond with JSON:
{
  "verified": true|false,
  "verificationState": "VERIFIED"|"REOPENED",
  "analysis": "detailed analysis",
  "confidence": 0.0-1.0,
  "remainingConcerns": ["concern1", "concern2"]
}`;

      const response = await modelRouter.generate('security_verification', verificationPrompt, { temperature: 0.1, maxTokens: 3000 });
      const verification = JSON.parse(response);

      finding.verificationState = verification.verified ? 'VERIFIED' : 'REOPENED';
      finding.status = verification.verified ? FindingStatus.VERIFIED : FindingStatus.REOPENED;
      finding.verifiedBy = AgentType.SENTINEL;
      finding.updatedAt = new Date();

      return finding;
    },

    async generateSecurityReport(findings: SecurityFinding[], mission: Mission): Promise<any> {
      const reportPrompt = `Generate a comprehensive security audit report for mission ${mission.id}:

OBJECTIVE: ${mission.objective}

FINDINGS (${findings.length} total):
${findings.map(f => `- [${f.severity}] ${f.category}: ${f.title} (${f.component})`).join('\n')}

Include:
1. Executive Summary
2. Threat Model Overview
3. Finding Details (grouped by severity)
4. Risk Assessment
5. Remediation Priorities
6. Compliance Mapping
7. Verification Status
8. Recommendations`;

      const report = await modelRouter.generate('security_report', reportPrompt, { temperature: 0.2, maxTokens: 5000 });

      const criticalCount = findings.filter(f => f.severity === FindingSeverity.CRITICAL).length;
      const highCount = findings.filter(f => f.severity === FindingSeverity.HIGH).length;
      const verifiedCount = findings.filter(f => f.verificationState === 'VERIFIED').length;

      return {
        report,
        summary: {
          totalFindings: findings.length,
          critical: criticalCount,
          high: highCount,
          verified: verifiedCount,
          unverified: findings.length - verifiedCount
        },
        findings: findings.map(f => ({
          id: f.findingId,
          severity: f.severity,
          category: f.category,
          component: f.component,
          status: f.status,
          verificationState: f.verificationState
        }))
      };
    }
  };

  return adapter;
}

async function executeThreatModeling(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const filesRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'list_directory',
    capability: PermissionScope.FILESYSTEM_READ,
    parameters: { path: '/workspace', recursive: true },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const filesResult = await toolBroker.execute(filesRequest);

  const prompt = `Generate a threat model for the application based on its structure:

FILES:
${JSON.stringify(filesResult.result, null, 2)}

MISSION OBJECTIVE: ${mission.objective}

Create a threat model with:
1. System boundaries and trust zones
2. Data flow diagram (text description)
3. Entry points and attack surfaces
4. Threat actors and their capabilities
5. Identified threats (STRIDE model)
6. Risk ratings for each threat
7. Recommended mitigations

Respond as structured JSON.`;

  const threatModel = await modelRouter.generate('threat_modeling', prompt, { temperature: 0.2, maxTokens: 4000 });
  return { threatModel: JSON.parse(threatModel), summary: 'Threat model generated' };
}

async function executeStaticAnalysis(task: Task, mission: Mission, toolBroker: ToolBroker): Promise<any> {
  const scanRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'run_command',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'npm', args: ['run', 'lint'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 120000,
    timestamp: new Date()
  };

  const lintResult = await toolBroker.execute(scanRequest);

  const typecheckRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'run_command',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'npm', args: ['run', 'typecheck'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 120000,
    timestamp: new Date()
  };

  const typecheckResult = await toolBroker.execute(typecheckRequest);

  const findings = parseStaticAnalysisResults(lintResult.result, typecheckResult.result);

  return { findings, lint: lintResult.result, typecheck: typecheckResult.result, summary: `Static analysis found ${findings.length} issues` };
}

async function executeDependencyAnalysis(task: Task, mission: Mission, toolBroker: ToolBroker): Promise<any> {
  const auditRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'run_command',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'npm', args: ['audit', '--json'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 60000,
    timestamp: new Date()
  };

  const auditResult = await toolBroker.execute(auditRequest);

  const findings = parseDependencyAudit(auditResult.result);

  return { findings, audit: auditResult.result, summary: `Dependency analysis found ${findings.length} vulnerabilities` };
}

async function executeSecretDetection(task: Task, mission: Mission, toolBroker: ToolBroker): Promise<any> {
  const secretRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'run_command',
    capability: PermissionScope.SANDBOX_EXECUTE,
    parameters: { command: 'gitleaks', args: ['detect', '--source', '/workspace', '--report-format', 'json'], cwd: '/workspace' },
    workspace: '/workspace',
    timeout: 60000,
    timestamp: new Date()
  };

  const secretResult = await toolBroker.execute(secretRequest);

  const findings = parseSecretDetection(secretResult.result);

  return { findings, scan: secretResult.result, summary: `Secret detection found ${findings.length} exposed secrets` };
}

async function executeSecurityReview(task: Task, mission: Mission, toolBroker: ToolBroker, modelRouter: ModelRouter): Promise<any> {
  const filesRequest: ToolRequest = {
    id: `req-${Date.now()}`,
    missionId: mission.id,
    taskId: task.id,
    agentId: 'sentinel-adapter',
    tool: 'list_directory',
    capability: PermissionScope.FILESYSTEM_READ,
    parameters: { path: '/workspace', recursive: true },
    workspace: '/workspace',
    timeout: 30000,
    timestamp: new Date()
  };

  const filesResult = await toolBroker.execute(filesRequest);

  const prompt = `Perform a comprehensive security review of the codebase:

FILES:
${JSON.stringify(filesResult.result, null, 2)}

Review for:
1. Authentication controls (password policies, MFA, session management, JWT handling)
2. Authorization controls (RBAC, ABAC, resource-level permissions, privilege escalation)
3. API security (input validation, rate limiting, CORS, authentication on endpoints)
4. Security-sensitive configuration (environment variables, secrets management, debug flags, CORS policies)
5. Data protection (encryption at rest/in transit, PII handling, key management)

Provide findings with severity, location, and remediation recommendations.`;

  const review = await modelRouter.generate('security_review', prompt, { temperature: 0.1, maxTokens: 5000 });
  const findings = parseSecurityReview(review);

  return { findings, summary: `Security review found ${findings.length} issues` };
}

async function executeFindingReport(task: Task, mission: Mission, modelRouter: ModelRouter): Promise<any> {
  return { message: 'Finding report generation - aggregate findings from previous tasks' };
}

function parseStaticAnalysisResults(lintResult: any, typecheckResult: any): SecurityFinding[] {
  return [];
}

function parseDependencyAudit(auditResult: any): SecurityFinding[] {
  return [];
}

function parseSecretDetection(secretResult: any): SecurityFinding[] {
  return [];
}

function parseSecurityReview(review: string): SecurityFinding[] {
  return [];
}