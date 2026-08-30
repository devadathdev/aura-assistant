export enum MissionStatus {
  CREATED = 'CREATED',
  PLANNING = 'PLANNING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ROLLING_BACK = 'ROLLING_BACK',
  ROLLED_BACK = 'ROLLED_BACK'
}

export enum TaskStatus {
  CREATED = 'CREATED',
  ANALYZING = 'ANALYZING',
  PLANNED = 'PLANNED',
  APPROVED = 'APPROVED',
  IMPLEMENTING = 'IMPLEMENTING',
  TESTING = 'TESTING',
  REVIEWING = 'REVIEWING',
  SECURITY_CHECK = 'SECURITY_CHECK',
  READY_FOR_PR = 'READY_FOR_PR',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
  WAITING_FOR_USER = 'WAITING_FOR_USER'
}

export enum AgentType {
  FORGE = 'FORGE',
  SENTINEL = 'SENTINEL',
  RESEARCH = 'RESEARCH',
  AUTOMATION = 'AUTOMATION'
}

export enum AgentCapability {
  REPOSITORY_INSPECTION = 'REPOSITORY_INSPECTION',
  ARCHITECTURE_PLANNING = 'ARCHITECTURE_PLANNING',
  FILE_CREATION = 'FILE_CREATION',
  CODE_MODIFICATION = 'CODE_MODIFICATION',
  DEPENDENCY_MANAGEMENT = 'DEPENDENCY_MANAGEMENT',
  BUILD_EXECUTION = 'BUILD_EXECUTION',
  UNIT_TESTING = 'UNIT_TESTING',
  INTEGRATION_TESTING = 'INTEGRATION_TESTING',
  FAILURE_ANALYSIS = 'FAILURE_ANALYSIS',
  PATCH_GENERATION = 'PATCH_GENERATION',
  CODE_REVIEW = 'CODE_REVIEW',
  GIT_CHECKPOINT = 'GIT_CHECKPOINT',
  DIFF_GENERATION = 'DIFF_GENERATION',
  ROLLBACK = 'ROLLBACK',
  BUILD_ARTIFACTS = 'BUILD_ARTIFACTS',
  THREAT_MODELING = 'THREAT_MODELING',
  STATIC_ANALYSIS = 'STATIC_ANALYSIS',
  DEPENDENCY_ANALYSIS = 'DEPENDENCY_ANALYSIS',
  SECRET_DETECTION = 'SECRET_DETECTION',
  AUTH_REVIEW = 'AUTH_REVIEW',
  AUTHZ_REVIEW = 'AUTHZ_REVIEW',
  API_SECURITY_REVIEW = 'API_SECURITY_REVIEW',
  CONFIG_SECURITY_REVIEW = 'CONFIG_SECURITY_REVIEW',
  FINDING_NORMALIZATION = 'FINDING_NORMALIZATION',
  SEVERITY_CLASSIFICATION = 'SEVERITY_CLASSIFICATION',
  REMEDIATION_RECOMMENDATION = 'REMEDIATION_RECOMMENDATION',
  INDEPENDENT_VERIFICATION = 'INDEPENDENT_VERIFICATION',
  BASELINE_VALIDATION = 'BASELINE_VALIDATION',
  SECURITY_REPORTING = 'SECURITY_REPORTING',
  WEB_RESEARCH = 'WEB_RESEARCH',
  DOCUMENTATION_RETRIEVAL = 'DOCUMENTATION_RETRIEVAL',
  REPOSITORY_RESEARCH = 'REPOSITORY_RESEARCH',
  DOCUMENT_ANALYSIS = 'DOCUMENT_ANALYSIS',
  FACT_VERIFICATION = 'FACT_VERIFICATION',
  EVIDENCE_SYNTHESIS = 'EVIDENCE_SYNTHESIS',
  DEVICE_OPERATIONS = 'DEVICE_OPERATIONS',
  FILE_WORKFLOWS = 'FILE_WORKFLOWS',
  APPLICATION_CONTROL = 'APPLICATION_CONTROL',
  CLOUD_OPERATIONS = 'CLOUD_OPERATIONS',
  DEPLOYMENT = 'DEPLOYMENT',
  SERVICE_MANAGEMENT = 'SERVICE_MANAGEMENT',
  MONITORING = 'MONITORING',
  SCHEDULED_WORKFLOWS = 'SCHEDULED_WORKFLOWS'
}

export enum PermissionScope {
  FILESYSTEM_READ = 'filesystem.read',
  FILESYSTEM_WORKSPACE_WRITE = 'filesystem.workspace.write',
  GIT_COMMIT = 'git.commit',
  GIT_PUSH = 'git.push',
  GIT_BRANCH = 'git.branch',
  SANDBOX_EXECUTE = 'sandbox.execute',
  NETWORK_HTTP_ALLOWLISTED = 'network.http.allowlisted',
  SECRETS_REQUEST = 'secrets.request',
  DEPLOYMENT_STAGING = 'deployment.staging',
  DEPLOYMENT_PRODUCTION = 'deployment.production'
}

export enum GovernanceDecision {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
  REQUIRE_APPROVAL = 'REQUIRE_APPROVAL',
  SANDBOX_ONLY = 'SANDBOX_ONLY',
  ALLOW_WITH_LIMITS = 'ALLOW_WITH_LIMITS'
}

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum FindingStatus {
  NEW = 'NEW',
  TRIAGED = 'TRIAGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  DISMISSED = 'DISMISSED',
  VERIFIED = 'VERIFIED',
  REOPENED = 'REOPENED'
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

export interface Mission {
  id: string;
  objective: string;
  status: MissionStatus;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  goals: Goal[];
  metadata: Record<string, unknown>;
}

export interface Goal {
  id: string;
  missionId: string;
  title: string;
  description: string;
  milestones: Milestone[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string;
  tasks: Task[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface Task {
  id: string;
  milestoneId: string;
  type: string;
  title: string;
  description: string;
  assignedAgent?: AgentType;
  capabilities: AgentCapability[];
  dependencies: string[];
  status: TaskStatus;
  requiredPermissions: PermissionScope[];
  requiresApproval: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: AgentCapability[];
  status: 'IDLE' | 'BUSY' | 'ERROR' | 'OFFLINE';
  health: number;
  lastHeartbeat: Date;
}

export interface AgentMessage {
  id: string;
  missionId: string;
  taskId?: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  type: 'TASK_REQUEST' | 'TASK_RESPONSE' | 'FINDING' | 'VERIFICATION' | 'APPROVAL_REQUEST' | 'STATUS_UPDATE';
  payload: unknown;
  timestamp: Date;
}

export interface SecurityFinding {
  id: string;
  missionId: string;
  taskId?: string;
  findingId: string;
  severity: FindingSeverity;
  category: string;
  component: string;
  location?: { file: string; line?: number };
  description: string;
  evidence: string;
  confidence: number;
  recommendation: string;
  status: FindingStatus;
  verificationState: 'UNVERIFIED' | 'VERIFIED' | 'REOPENED';
  detectedBy: AgentType;
  verifiedBy?: AgentType;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalRequest {
  id: string;
  missionId: string;
  taskId?: string;
  requestingAgent: AgentType;
  action: string;
  target: string;
  reason: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedResources: string[];
  rollbackAvailable: boolean;
  sentinelStatus?: string;
  status: ApprovalStatus;
  requestedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  response?: unknown;
}

export interface ToolRequest {
  id: string;
  missionId: string;
  taskId: string;
  agentId: string;
  tool: string;
  capability: PermissionScope;
  parameters: Record<string, unknown>;
  workspace: string;
  timeout: number;
  timestamp: Date;
}

export interface ToolExecution {
  id: string;
  requestId: string;
  missionId: string;
  taskId: string;
  agentId: string;
  tool: string;
  capability: PermissionScope;
  parameters: Record<string, unknown>;
  result?: unknown;
  error?: string;
  governanceDecision: GovernanceDecision;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface GitCheckpoint {
  id: string;
  missionId: string;
  taskId?: string;
  repository: string;
  startingHead: string;
  branch: string;
  changes: FileChange[];
  commands: string[];
  tests: string[];
  findings: string[];
  artifacts: string[];
  finalHead?: string;
  createdAt: Date;
}

export interface FileChange {
  path: string;
  action: 'CREATE' | 'MODIFY' | 'DELETE';
  content?: string;
  diff?: string;
}

export interface ContextLayer {
  userContext: Record<string, unknown>;
  projectContext: Record<string, unknown>;
  missionContext: Record<string, unknown>;
  agentContext: Record<string, unknown>;
  taskContext: Record<string, unknown>;
}

export interface ModelRoute {
  taskType: string;
  preferredModel: string;
  fallbackModels: string[];
  reasoning: string;
}

export interface AuditEvent {
  id: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  actor: string;
  eventType: string;
  objectRef?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  previousHash?: string;
  eventHash: string;
}