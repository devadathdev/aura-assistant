import { Mission, Goal, Milestone, Task, AgentCapability, PermissionScope, TaskStatus, MissionStatus, AgentType, FindingSeverity, FindingStatus, ApprovalStatus } from '../shared/types';

export interface IntentResult {
  primaryIntent: string;
  secondaryIntents: string[];
  confidence: number;
  entities: Record<string, unknown>;
  suggestedAgentTypes: AgentType[];
  requiredCapabilities: AgentCapability[];
}

export class IntentService {
  private modelRouter: any;

  constructor(modelRouter: any) {
    this.modelRouter = modelRouter;
  }

  async analyzeRequest(request: string, context: Record<string, unknown>): Promise<IntentResult> {
    const prompt = `Analyze the following user request and extract the primary intent, secondary intents, entities, and required agent capabilities.

Request: "${request}"

Context: ${JSON.stringify(context)}

Available agent types: FORGE (engineering), SENTINEL (security), RESEARCH (knowledge), AUTOMATION (operations)
Available capabilities: REPOSITORY_INSPECTION, ARCHITECTURE_PLANNING, FILE_CREATION, CODE_MODIFICATION, DEPENDENCY_MANAGEMENT, BUILD_EXECUTION, UNIT_TESTING, INTEGRATION_TESTING, FAILURE_ANALYSIS, PATCH_GENERATION, CODE_REVIEW, GIT_CHECKPOINT, DIFF_GENERATION, ROLLBACK, BUILD_ARTIFACTS, THREAT_MODELING, STATIC_ANALYSIS, DEPENDENCY_ANALYSIS, SECRET_DETECTION, AUTH_REVIEW, AUTHZ_REVIEW, API_SECURITY_REVIEW, CONFIG_SECURITY_REVIEW, FINDING_NORMALIZATION, SEVERITY_CLASSIFICATION, REMEDIATION_RECOMMENDATION, INDEPENDENT_VERIFICATION, BASELINE_VALIDATION, SECURITY_REPORTING, WEB_RESEARCH, DOCUMENTATION_RETRIEVAL, REPOSITORY_RESEARCH, DOCUMENT_ANALYSIS, FACT_VERIFICATION, EVIDENCE_SYNTHESIS, DEVICE_OPERATIONS, FILE_WORKFLOWS, APPLICATION_CONTROL, CLOUD_OPERATIONS, DEPLOYMENT, SERVICE_MANAGEMENT, MONITORING, SCHEDULED_WORKFLOWS

Respond with JSON only:
{
  "primaryIntent": "string",
  "secondaryIntents": ["string"],
  "confidence": 0.0-1.0,
  "entities": {},
  "suggestedAgentTypes": ["FORGE" | "SENTINEL" | "RESEARCH" | "AUTOMATION"],
  "requiredCapabilities": ["CAPABILITY_NAME"]
}`;

    try {
      const response = await this.modelRouter.generate(prompt, { temperature: 0.1 });
      return JSON.parse(response);
    } catch (error) {
      return this.fallbackAnalysis(request);
    }
  }

  private fallbackAnalysis(request: string): IntentResult {
    const lower = request.toLowerCase();
    const intents: string[] = [];
    const capabilities: AgentCapability[] = [];
    const agentTypes: AgentType[] = [];

    if (lower.includes('build') || lower.includes('create') || lower.includes('implement') || lower.includes('develop') || lower.includes('code') || lower.includes('engineer')) {
      intents.push('engineering');
      agentTypes.push(AgentType.FORGE);
      capabilities.push(AgentCapability.ARCHITECTURE_PLANNING, AgentCapability.FILE_CREATION, AgentCapability.CODE_MODIFICATION, AgentCapability.BUILD_EXECUTION, AgentCapability.UNIT_TESTING);
    }

    if (lower.includes('security') || lower.includes('secure') || lower.includes('vulnerab') || lower.includes('threat') || lower.includes('audit') || lower.includes('scan')) {
      intents.push('security');
      agentTypes.push(AgentType.SENTINEL);
      capabilities.push(AgentCapability.THREAT_MODELING, AgentCapability.STATIC_ANALYSIS, AgentCapability.DEPENDENCY_ANALYSIS, AgentCapability.SECRET_DETECTION);
    }

    if (lower.includes('research') || lower.includes('find') || lower.includes('search') || lower.includes('document') || lower.includes('analyze') || lower.includes('verify')) {
      intents.push('research');
      agentTypes.push(AgentType.RESEARCH);
      capabilities.push(AgentCapability.WEB_RESEARCH, AgentCapability.DOCUMENTATION_RETRIEVAL, AgentCapability.FACT_VERIFICATION);
    }

    if (lower.includes('deploy') || lower.includes('release') || lower.includes('operat') || lower.includes('monitor') || lower.includes('automat')) {
      intents.push('operations');
      agentTypes.push(AgentType.AUTOMATION);
      capabilities.push(AgentCapability.DEPLOYMENT, AgentCapability.SERVICE_MANAGEMENT, AgentCapability.MONITORING);
    }

    if (agentTypes.length === 0) {
      agentTypes.push(AgentType.FORGE);
      capabilities.push(AgentCapability.REPOSITORY_INSPECTION, AgentCapability.ARCHITECTURE_PLANNING);
    }

    return {
      primaryIntent: intents[0] || 'general',
      secondaryIntents: intents.slice(1),
      confidence: 0.7,
      entities: {},
      suggestedAgentTypes: [...new Set(agentTypes)],
      requiredCapabilities: [...new Set(capabilities)]
    };
  }
}