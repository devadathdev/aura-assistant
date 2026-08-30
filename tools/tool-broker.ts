import { ToolRequest, ToolExecution, GovernanceDecision, PermissionScope } from '../shared/types';
import { GovernanceEngine } from '../governance/governance-engine';
import Wiki from 'wikijs';

export interface ToolExecutor {
  execute(request: ToolRequest): Promise<unknown>;
  supportsTool(tool: string): boolean;
}

class WikipediaExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['wikipedia_search', 'wikipedia_page', 'wikipedia_summary', 'wikipedia_random'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    const { query, title, language = 'en' } = request.parameters as any;
    
    try {
      const wiki = Wiki({ apiUrl: `https://${language}.wikipedia.org/w/api.php` });

      switch (request.tool) {
        case 'wikipedia_search': {
          const results = await wiki.search(query);
          return { results, query };
        }
        case 'wikipedia_page': {
          const page = await wiki.page(title);
          const content = await page.content();
          const summary = await page.summary();
          const links = await page.links();
          return { title: page.raw.title, content, summary, links };
        }
        case 'wikipedia_summary': {
          const page = await wiki.page(title);
          const summary = await page.summary();
          return { title, summary };
        }
        case 'wikipedia_random': {
          const page = await wiki.random();
          const summary = await page.summary();
          return { title: page.raw.title, summary };
        }
      }
    } catch (error) {
      return { error: String(error) };
    }
    return {};
  }
}

export class ToolBroker {
  private governance: GovernanceEngine;
  private executors: Map<string, ToolExecutor> = new Map();
  private executionHistory: ToolExecution[] = [];

  constructor(governance: GovernanceEngine) {
    this.governance = governance;
  }

  registerExecutor(executor: ToolExecutor): void {
    const supportedTools = this.getSupportedTools(executor);
    for (const tool of supportedTools) {
      this.executors.set(tool, executor);
    }
  }

  private getSupportedTools(executor: ToolExecutor): string[] {
    if (executor instanceof SandboxExecutor) return ['run_command', 'run_tests', 'run_build', 'run_linter', 'run_typecheck', 'install_dependencies'];
    if (executor instanceof FileSystemExecutor) return ['read_file', 'write_file', 'delete_file', 'search_files', 'list_directory'];
    if (executor instanceof GitExecutor) return ['git_status', 'git_diff', 'git_create_branch', 'git_commit', 'git_push', 'github_create_pr', 'github_merge_pr'];
    if (executor instanceof NetworkExecutor) return ['fetch', 'http_request'];
    if (executor instanceof SecretExecutor) return ['get_secret', 'set_secret', 'rotate_secret'];
    if (executor instanceof DeploymentExecutor) return ['deploy_staging', 'deploy_production', 'service_start', 'service_stop', 'service_restart'];
    if (executor instanceof WikipediaExecutor) return ['wikipedia_search', 'wikipedia_page', 'wikipedia_summary', 'wikipedia_random'];
    return [];
  }

  async execute(request: ToolRequest): Promise<ToolExecution> {
    const execution: ToolExecution = {
      id: this.generateId(),
      requestId: request.id,
      missionId: request.missionId,
      taskId: request.taskId,
      agentId: request.agentId,
      tool: request.tool,
      capability: request.capability,
      parameters: request.parameters,
      governanceDecision: GovernanceDecision.DENY,
      startedAt: new Date()
    };

    try {
      execution.governanceDecision = await this.governance.evaluate(request);

      if (execution.governanceDecision === GovernanceDecision.DENY) {
        execution.error = 'Denied by governance policy';
        execution.completedAt = new Date();
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        this.executionHistory.push(execution);
        return execution;
      }

      if (execution.governanceDecision === GovernanceDecision.SANDBOX_ONLY) {
        request.parameters = { ...request.parameters, sandbox: true };
      }

      const executor = this.executors.get(request.tool);
      if (!executor) {
        execution.error = `No executor found for tool: ${request.tool}`;
        execution.governanceDecision = GovernanceDecision.DENY;
        execution.completedAt = new Date();
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        this.executionHistory.push(execution);
        return execution;
      }

      execution.result = await executor.execute(request);
      execution.governanceDecision = GovernanceDecision.ALLOW;
    } catch (error) {
      execution.error = String(error);
      execution.governanceDecision = GovernanceDecision.DENY;
    } finally {
      execution.completedAt = new Date();
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      this.executionHistory.push(execution);
    }

    return execution;
  }

  getExecutionHistory(missionId?: string): ToolExecution[] {
    if (missionId) {
      return this.executionHistory.filter(e => e.missionId === missionId);
    }
    return [...this.executionHistory];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

class SandboxExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['run_command', 'run_tests', 'run_build', 'run_linter', 'run_typecheck', 'install_dependencies'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    const { command, args = [], cwd = '/workspace', timeout = 30000 } = request.parameters as any;
    return { stdout: '', stderr: '', exitCode: 0, timedOut: false };
  }
}

class FileSystemExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['read_file', 'write_file', 'delete_file', 'search_files', 'list_directory'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    const { path, content, pattern } = request.parameters as any;
    switch (request.tool) {
      case 'read_file': return { content: '', path };
      case 'write_file': return { written: true, path };
      case 'delete_file': return { deleted: true, path };
      case 'search_files': return { matches: [], pattern };
      case 'list_directory': return { entries: [], path };
    }
    return {};
  }
}

class GitExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['git_status', 'git_diff', 'git_create_branch', 'git_commit', 'git_push', 'github_create_pr', 'github_merge_pr'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true, tool: request.tool };
  }
}

class NetworkExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['fetch', 'http_request'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    const { url, method = 'GET', headers = {}, body } = request.parameters as any;
    return { status: 200, data: {}, headers: {} };
  }
}

class SecretExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['get_secret', 'set_secret', 'rotate_secret'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true, tool: request.tool };
  }
}

class DeploymentExecutor implements ToolExecutor {
  supportsTool(tool: string): boolean {
    return ['deploy_staging', 'deploy_production', 'service_start', 'service_stop', 'service_restart'].includes(tool);
  }

  async execute(request: ToolRequest): Promise<unknown> {
    return { success: true, tool: request.tool, deploymentId: `deploy-${Date.now()}` };
  }
}