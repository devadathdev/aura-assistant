-- AURA Database Schema
-- PostgreSQL schema for Missions, Tasks, Findings, Approvals, and Audit Events

-- Users and Projects
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    github_repo_url TEXT,
    github_installation_id VARCHAR(100),
    default_branch VARCHAR(100) DEFAULT 'main',
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missions
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    objective TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    goals JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_missions_project_id ON missions(project_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_created_at ON missions(created_at);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    milestone_id UUID,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_agent VARCHAR(50),
    capabilities JSONB DEFAULT '[]',
    dependencies JSONB DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    required_permissions JSONB DEFAULT '[]',
    requires_approval BOOLEAN DEFAULT FALSE,
    risk_level VARCHAR(20) DEFAULT 'MEDIUM',
    result JSONB,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_mission_id ON tasks(mission_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_agent ON tasks(assigned_agent);

-- Task Dependencies (for complex DAGs)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, depends_on_task_id)
);

-- Security Findings
CREATE TABLE IF NOT EXISTS security_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id),
    finding_id VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(100) NOT NULL,
    component VARCHAR(255) NOT NULL,
    location_file TEXT,
    location_line INTEGER,
    description TEXT NOT NULL,
    evidence TEXT,
    confidence DECIMAL(3,2) DEFAULT 0.5,
    recommendation TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    verification_state VARCHAR(30) DEFAULT 'UNVERIFIED',
    detected_by VARCHAR(50) NOT NULL,
    verified_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_findings_mission_id ON security_findings(mission_id);
CREATE INDEX idx_security_findings_severity ON security_findings(severity);
CREATE INDEX idx_security_findings_status ON security_findings(status);
CREATE INDEX idx_security_findings_verification ON security_findings(verification_state);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id),
    requesting_agent VARCHAR(50) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    risk VARCHAR(20) NOT NULL,
    affected_resources JSONB DEFAULT '[]',
    rollback_available BOOLEAN DEFAULT FALSE,
    sentinel_status VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    payload JSONB DEFAULT '{}',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    response JSONB
);

CREATE INDEX idx_approvals_mission_id ON approvals(mission_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- Tool Requests and Executions
CREATE TABLE IF NOT EXISTS tool_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    capability VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL,
    workspace VARCHAR(500) NOT NULL,
    timeout INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_requests_mission_id ON tool_requests(mission_id);
CREATE INDEX idx_tool_requests_task_id ON tool_requests(task_id);

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES tool_requests(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    capability VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL,
    result JSONB,
    error TEXT,
    governance_decision VARCHAR(30) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

CREATE INDEX idx_tool_executions_mission_id ON tool_executions(mission_id);
CREATE INDEX idx_tool_executions_task_id ON tool_executions(task_id);
CREATE INDEX idx_tool_executions_request_id ON tool_executions(request_id);

-- Git Checkpoints
CREATE TABLE IF NOT EXISTS git_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id),
    repository VARCHAR(500) NOT NULL,
    starting_head VARCHAR(100) NOT NULL,
    branch VARCHAR(255) NOT NULL,
    changes JSONB DEFAULT '[]',
    commands JSONB DEFAULT '[]',
    tests JSONB DEFAULT '[]',
    findings JSONB DEFAULT '[]',
    artifacts JSONB DEFAULT '[]',
    final_head VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_git_checkpoints_mission_id ON git_checkpoints(mission_id);

-- Audit Events (append-only)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id),
    task_id UUID REFERENCES tasks(id),
    agent_id VARCHAR(255),
    actor VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    object_ref VARCHAR(255),
    payload JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL
);

CREATE INDEX idx_audit_events_mission_id ON audit_events(mission_id);
CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp);
CREATE INDEX idx_audit_events_actor ON audit_events(actor);

-- Memories (hierarchical context)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    mission_id UUID REFERENCES missions(id),
    agent_type VARCHAR(50),
    task_id UUID REFERENCES tasks(id),
    layer VARCHAR(50) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_project_id ON memories(project_id);
CREATE INDEX idx_memories_mission_id ON memories(mission_id);
CREATE INDEX idx_memories_layer_key ON memories(layer, key);

-- Agent Runs (execution tracking)
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    model_config JSONB DEFAULT '{}',
    prompt TEXT,
    response TEXT,
    tool_calls JSONB DEFAULT '[]',
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_mission_id ON agent_runs(mission_id);
CREATE INDEX idx_agent_runs_task_id ON agent_runs(task_id);

-- Execution Nodes (for distributed execution)
CREATE TABLE IF NOT EXISTS execution_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    capabilities JSONB DEFAULT '[]',
    trust_level VARCHAR(20) NOT NULL,
    resources JSONB DEFAULT '{}',
    runtimes JSONB DEFAULT '[]',
    tools JSONB DEFAULT '[]',
    health JSONB DEFAULT '{}',
    available BOOLEAN DEFAULT TRUE,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Functions for audit hash chaining
CREATE OR REPLACE FUNCTION compute_audit_hash(
    p_id UUID,
    p_actor VARCHAR,
    p_event_type VARCHAR,
    p_object_ref VARCHAR,
    p_timestamp TIMESTAMPTZ,
    p_previous_hash VARCHAR,
    p_payload JSONB
) RETURNS VARCHAR AS $$
DECLARE
    hash_data JSONB;
    hash_text TEXT;
BEGIN
    hash_data := jsonb_build_object(
        'id', p_id,
        'actor', p_actor,
        'event_type', p_event_type,
        'object_ref', p_object_ref,
        'timestamp', p_timestamp,
        'previous_hash', p_previous_hash,
        'payload', p_payload
    );
    hash_text := hash_data::text;
    RETURN encode(digest(hash_text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to maintain audit hash chain
CREATE OR REPLACE FUNCTION maintain_audit_chain()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash VARCHAR(64);
BEGIN
    SELECT event_hash INTO prev_hash
    FROM audit_events
    ORDER BY timestamp DESC
    LIMIT 1;

    NEW.previous_hash := prev_hash;
    NEW.event_hash := compute_audit_hash(
        NEW.id, NEW.actor, NEW.event_type, NEW.object_ref,
        NEW.timestamp, NEW.previous_hash, NEW.payload
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_chain_trigger ON audit_events;
CREATE TRIGGER audit_chain_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION maintain_audit_chain();

-- View for mission progress
CREATE OR REPLACE VIEW mission_progress AS
SELECT
    m.id AS mission_id,
    m.objective,
    m.status AS mission_status,
    m.created_at,
    m.started_at,
    m.completed_at,
    COUNT(t.id) AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED') AS completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'FAILED') AS failed_tasks,
    COUNT(t.id) FILTER (WHERE t.status IN ('CREATED', 'ANALYZING', 'PLANNED', 'APPROVED', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'SECURITY_CHECK')) AS pending_tasks,
    COUNT(sf.id) AS total_findings,
    COUNT(sf.id) FILTER (WHERE sf.severity IN ('CRITICAL', 'HIGH')) AS critical_high_findings,
    COUNT(sf.id) FILTER (WHERE sf.verification_state = 'VERIFIED') AS verified_findings,
    COUNT(a.id) FILTER (WHERE a.status = 'PENDING') AS pending_approvals
FROM missions m
LEFT JOIN tasks t ON t.mission_id = m.id
LEFT JOIN security_findings sf ON sf.mission_id = m.id
LEFT JOIN approvals a ON a.mission_id = m.id
GROUP BY m.id;

-- View for agent performance
CREATE OR REPLACE VIEW agent_performance AS
SELECT
    ar.agent_type,
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE ar.status = 'SUCCESS') AS successful_runs,
    COUNT(*) FILTER (WHERE ar.status = 'FAILED') AS failed_runs,
    AVG(ar.duration_ms) AS avg_duration_ms,
    SUM(ar.tokens_used) AS total_tokens,
    SUM(ar.cost_usd) AS total_cost_usd
FROM agent_runs ar
GROUP BY ar.agent_type;