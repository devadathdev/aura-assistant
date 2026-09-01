import { Skill, SkillManifest, SkillContext, SkillResult } from '../skill-registry';

export const codeAnalysisSkill: SkillManifest = {
  id: 'code-analysis',
  name: 'Code Analysis',
  version: '1.0.0',
  description: 'Analyzes code snippets for issues, best practices, and improvements',
  author: 'AURA Team',
  category: 'development',
  tags: ['code', 'analysis', 'lint', 'review'],
  permissions: [
    { type: 'model', scope: ['analysis'], description: 'Uses AI model for code analysis' },
    { type: 'filesystem', scope: ['read'], description: 'Reads code files for analysis' }
  ],
  entryPoint: 'codeAnalysisHooks',
  defaultConfig: {
    autoAnalyze: true,
    severityThreshold: 'warning',
    languages: ['typescript', 'javascript', 'python', 'go', 'rust']
  },
  enabled: true
};

export const codeAnalysisHooks = {
  async onUserMessage(input: string, context: SkillContext): Promise<SkillResult | null> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const matches = [...input.matchAll(codeBlockRegex)];
    
    if (matches.length === 0 && !input.toLowerCase().includes('analyze') && !input.toLowerCase().includes('review code')) {
      return null;
    }

    if (matches.length > 0) {
      const analyses = await Promise.all(matches.map(async (match) => {
        const language = match[1] || 'text';
        const code = match[2];
        return await analyzeCode(code, language, context);
      }));
      
      return {
        success: true,
        output: analyses.map(a => a.output).join('\n\n---\n\n'),
        data: { analyses },
        metadata: { skill: 'code-analysis', type: 'code_block_analysis' }
      };
    }

    if (input.toLowerCase().includes('analyze') || input.toLowerCase().includes('review code')) {
      return {
        success: true,
        output: 'Please share the code you\'d like me to analyze by pasting it in a code block, or specify a file path.',
        metadata: { skill: 'code-analysis', type: 'prompt_for_code' }
      };
    }

    return null;
  },

  async onCommand(command: string, args: string[], context: SkillContext): Promise<SkillResult | null> {
    if (command === 'analyze' || command === 'code-review') {
      const code = args.join(' ');
      if (!code) {
        return { success: false, error: 'No code provided. Usage: /analyze <code> or paste code in a block.' };
      }
      
      const analysis = await analyzeCode(code, 'auto', context);
      return { success: true, output: analysis.output, data: analysis.data };
    }
    return null;
  }
};

async function analyzeCode(code: string, language: string, context: SkillContext): Promise<SkillResult> {
  const prompt = `Analyze this ${language} code for:
1. Bugs and logic errors
2. Security vulnerabilities
3. Performance issues
4. Best practice violations
5. Code style and maintainability

Code:
\`\`\`${language}
${code}
\`\`\`

Provide a concise analysis with specific line references where possible.`;

  return {
    success: true,
    output: `Code analysis requested for ${language} (${code.length} chars). In a full implementation, this would call the AI model with the analysis prompt.`,
    data: { code, language, prompt },
    metadata: { skill: 'code-analysis' }
  };
}

export const taskAutomationSkill: SkillManifest = {
  id: 'task-automation',
  name: 'Task Automation',
  version: '1.0.0',
  description: 'Automates repetitive tasks and workflows',
  author: 'AURA Team',
  category: 'productivity',
  tags: ['automation', 'workflow', 'tasks', 'scheduler'],
  permissions: [
    { type: 'shell', scope: ['execute'], description: 'Runs automation scripts' },
    { type: 'filesystem', scope: ['read', 'write'], description: 'Manages task files and scripts' },
    { type: 'api', scope: ['forge'], description: 'Triggers FORGE runs' }
  ],
  entryPoint: 'taskAutomationHooks',
  defaultConfig: {
    maxConcurrentTasks: 3,
    defaultTimeout: 300000,
    retryAttempts: 2
  },
  enabled: true
};

export const taskAutomationHooks = {
  async onUserMessage(input: string, context: SkillContext): Promise<SkillResult | null> {
    const automationTriggers = [
      'automate', 'create script', 'build workflow', 'schedule task',
      'auto deploy', 'auto test', 'auto build', 'pipeline'
    ];
    
    if (!automationTriggers.some(t => input.toLowerCase().includes(t))) {
      return null;
    }

    return {
      success: true,
      output: 'I can help you create automation workflows. What would you like to automate? For example:\n- "Create a deploy script for my Node.js app"\n- "Set up auto-testing on file changes"\n- "Build a CI/CD pipeline"\n- "Schedule daily database backups"',
      metadata: { skill: 'task-automation', type: 'automation_prompt' }
    };
  },

  async onCommand(command: string, args: string[], context: SkillContext): Promise<SkillResult | null> {
    if (command === 'automate' || command === 'workflow') {
      const taskType = args[0];
      const details = args.slice(1).join(' ');
      
      return {
        success: true,
        output: `Automation task "${taskType}" queued: ${details}. This would trigger the automation engine.`,
        data: { taskType, details },
        actions: [{ type: 'task', payload: { type: 'automation', taskType, details } }]
      };
    }
    return null;
  }
};

export const securityAuditSkill: SkillManifest = {
  id: 'security-audit',
  name: 'Security Audit',
  version: '1.0.0',
  description: 'Scans for security vulnerabilities and compliance issues',
  author: 'AURA Team',
  category: 'security',
  tags: ['security', 'audit', 'vulnerability', 'compliance', 'sentinel'],
  permissions: [
    { type: 'api', scope: ['sentinel'], description: 'Integrates with SENTINEL for security scanning' },
    { type: 'shell', scope: ['semgrep', 'gitleaks', 'trivy'], description: 'Runs security scanners' },
    { type: 'filesystem', scope: ['read'], description: 'Scans codebase for vulnerabilities' }
  ],
  entryPoint: 'securityAuditHooks',
  defaultConfig: {
    scanOnSave: false,
    severityFilter: 'medium',
    scanners: ['semgrep', 'gitleaks', 'trivy', 'npm-audit'],
    autoRemediate: false
  },
  enabled: true
};

export const securityAuditHooks = {
  async onUserMessage(input: string, context: SkillContext): Promise<SkillResult | null> {
    const securityTriggers = [
      'security audit', 'vulnerability scan', 'check security', 'scan for vulnerabilities',
      'compliance', 'penetration test', 'threat model'
    ];
    
    if (!securityTriggers.some(t => input.toLowerCase().includes(t))) {
      return null;
    }

    return {
      success: true,
      output: 'Security audit capabilities available. I can:\n- Run SAST scans (Semgrep)\n- Check for secrets (Gitleaks)\n- Scan containers (Trivy)\n- Audit dependencies (npm/pip-audit)\n- Check compliance frameworks\n\nWhat would you like to scan?',
      metadata: { skill: 'security-audit', type: 'security_prompt' }
    };
  },

  async onCommand(command: string, args: string[], context: SkillContext): Promise<SkillResult | null> {
    if (command === 'security-scan' || command === 'audit') {
      const target = args[0] || 'workspace';
      const scanner = args[1] || 'all';
      
      return {
        success: true,
        output: `Security scan initiated on ${target} using ${scanner}. Results will appear in the SENTINEL panel.`,
        data: { target, scanner },
        actions: [{ type: 'tool_call', payload: { tool: 'security_scan', target, scanner } }]
      };
    }
    return null;
  }
};

export const dataAnalysisSkill: SkillManifest = {
  id: 'data-analysis',
  name: 'Data Analysis',
  version: '1.0.0',
  description: 'Performs data analysis, visualization, and insights generation',
  author: 'AURA Team',
  category: 'analysis',
  tags: ['data', 'analytics', 'visualization', 'statistics', 'ml'],
  permissions: [
    { type: 'model', scope: ['analysis'], description: 'Uses AI for data insights' },
    { type: 'filesystem', scope: ['read', 'write'], description: 'Processes data files' },
    { type: 'shell', scope: ['python', 'jupyter'], description: 'Runs data analysis scripts' }
  ],
  entryPoint: 'dataAnalysisHooks',
  defaultConfig: {
    defaultFormat: 'csv',
    maxRows: 100000,
    enableML: false
  },
  enabled: true
};

export const dataAnalysisHooks = {
  async onUserMessage(input: string, context: SkillContext): Promise<SkillResult | null> {
    const dataTriggers = [
      'analyze data', 'data analysis', 'visualize', 'chart', 'graph',
      'statistics', 'correlation', 'trend', 'dashboard'
    ];
    
    if (!dataTriggers.some(t => input.toLowerCase().includes(t))) {
      return null;
    }

    return {
      success: true,
      output: 'Data analysis mode activated. You can:\n- Upload CSV/JSON/Parquet files\n- Request statistical summaries\n- Generate visualizations (charts, graphs)\n- Find correlations and trends\n- Build dashboards\n\nShare your data or describe what you need analyzed.',
      metadata: { skill: 'data-analysis', type: 'data_prompt' }
    };
  },

  async onCommand(command: string, args: string[], context: SkillContext): Promise<SkillResult | null> {
    if (command === 'analyze-data' || command === 'visualize') {
      const filePath = args[0];
      const analysisType = args[1] || 'summary';
      
      return {
        success: true,
        output: `Data analysis requested for ${filePath} (${analysisType}). This would process the file and generate insights.`,
        data: { filePath, analysisType },
        actions: [{ type: 'tool_call', payload: { tool: 'data_analyze', filePath, analysisType } }]
      };
    }
    return null;
  }
};

export const documentationSkill: SkillManifest = {
  id: 'documentation',
  name: 'Documentation Generator',
  version: '1.0.0',
  description: 'Generates and maintains documentation from code',
  author: 'AURA Team',
  category: 'development',
  tags: ['documentation', 'docs', 'readme', 'api-docs', 'comments'],
  permissions: [
    { type: 'model', scope: ['generation'], description: 'Generates documentation using AI' },
    { type: 'filesystem', scope: ['read', 'write'], description: 'Reads code and writes docs' }
  ],
  entryPoint: 'documentationHooks',
  defaultConfig: {
    formats: ['markdown', 'jsdoc', 'openapi'],
    includeExamples: true,
    updateOnChange: false
  },
  enabled: true
};

export const documentationHooks = {
  async onUserMessage(input: string, context: SkillContext): Promise<SkillResult | null> {
    const docTriggers = [
      'generate docs', 'create documentation', 'write readme', 'document this',
      'api documentation', 'add comments', 'update docs'
    ];
    
    if (!docTriggers.some(t => input.toLowerCase().includes(t))) {
      return null;
    }

    return {
      success: true,
      output: 'Documentation generator ready. I can:\n- Generate README files\n- Create API documentation (OpenAPI/Swagger)\n- Add JSDoc/TSDoc comments\n- Write user guides\n- Generate changelogs\n\nWhat documentation do you need?',
      metadata: { skill: 'documentation', type: 'doc_prompt' }
    };
  },

  async onCommand(command: string, args: string[], context: SkillContext): Promise<SkillResult | null> {
    if (command === 'generate-docs' || command === 'document') {
      const target = args[0] || 'project';
      const format = args[1] || 'markdown';
      
      return {
        success: true,
        output: `Documentation generation started for ${target} in ${format} format.`,
        data: { target, format },
        actions: [{ type: 'tool_call', payload: { tool: 'generate_docs', target, format } }]
      };
    }
    return null;
  }
};

export const allSkills = [
  { manifest: codeAnalysisSkill, hooks: codeAnalysisHooks },
  { manifest: taskAutomationSkill, hooks: taskAutomationHooks },
  { manifest: securityAuditSkill, hooks: securityAuditHooks },
  { manifest: dataAnalysisSkill, hooks: dataAnalysisHooks },
  { manifest: documentationSkill, hooks: documentationHooks }
];