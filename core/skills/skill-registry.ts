export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'productivity' | 'development' | 'security' | 'analysis' | 'utility' | 'ai' | 'custom';
  tags: string[];
  permissions: SkillPermission[];
  entryPoint: string;
  configSchema?: SkillConfigSchema;
  defaultConfig?: Record<string, any>;
  enabled: boolean;
}

export interface SkillPermission {
  type: 'filesystem' | 'network' | 'shell' | 'api' | 'database' | 'model' | 'memory';
  scope: string[];
  description: string;
}

export interface SkillConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    default?: any;
    enum?: any[];
    required?: boolean;
  }>;
  required?: string[];
}

export interface SkillContext {
  userInput: string;
  history: Array<{ role: string; content: string }>;
  memories: string[];
  currentModel: string;
  timestamp: number;
  workspace: string;
  config: Record<string, any>;
  services: {
    forge?: { url: string; available: boolean };
    sentinel?: { url: string; available: boolean };
  };
}

export interface SkillResult {
  success: boolean;
  output?: string;
  data?: any;
  actions?: SkillAction[];
  error?: string;
  metadata?: Record<string, any>;
}

export interface SkillAction {
  type: 'message' | 'tool_call' | 'navigation' | 'notification' | 'memory' | 'task';
  payload: any;
}

export interface SkillHooks {
  onInit?: (context: SkillContext) => Promise<void> | void;
  onUserMessage?: (input: string, context: SkillContext) => Promise<SkillResult | null> | SkillResult | null;
  onAssistantResponse?: (response: string, context: SkillContext) => Promise<SkillResult | null> | SkillResult | null;
  onCommand?: (command: string, args: string[], context: SkillContext) => Promise<SkillResult | null> | SkillResult | null;
  onInterval?: (context: SkillContext) => Promise<SkillResult | null> | SkillResult | null;
  onShutdown?: (context: SkillContext) => Promise<void> | void;
  onConfigChange?: (newConfig: Record<string, any>, context: SkillContext) => Promise<void> | void;
}

export class Skill {
  manifest: SkillManifest;
  hooks: SkillHooks;
  context: SkillContext | null = null;
  private initialized = false;

  constructor(manifest: SkillManifest, hooks: SkillHooks) {
    this.manifest = manifest;
    this.hooks = hooks;
  }

  async initialize(context: SkillContext): Promise<void> {
    this.context = { ...context, config: { ...this.manifest.defaultConfig, ...context.config } };
    if (this.hooks.onInit) {
      await this.hooks.onInit(this.context);
    }
    this.initialized = true;
  }

  async handleUserMessage(input: string): Promise<SkillResult | null> {
    if (!this.initialized || !this.context) return null;
    if (this.hooks.onUserMessage) {
      return await this.hooks.onUserMessage(input, this.context);
    }
    return null;
  }

  async handleAssistantResponse(response: string): Promise<SkillResult | null> {
    if (!this.initialized || !this.context) return null;
    if (this.hooks.onAssistantResponse) {
      return await this.hooks.onAssistantResponse(response, this.context);
    }
    return null;
  }

  async handleCommand(command: string, args: string[]): Promise<SkillResult | null> {
    if (!this.initialized || !this.context) return null;
    if (this.hooks.onCommand) {
      return await this.hooks.onCommand(command, args, this.context);
    }
    return null;
  }

  async handleInterval(): Promise<SkillResult | null> {
    if (!this.initialized || !this.context) return null;
    if (this.hooks.onInterval) {
      return await this.hooks.onInterval(this.context);
    }
    return null;
  }

  async updateConfig(newConfig: Record<string, any>): Promise<void> {
    if (!this.context) return;
    this.context.config = { ...this.context.config, ...newConfig };
    if (this.hooks.onConfigChange) {
      await this.hooks.onConfigChange(this.context.config, this.context);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || !this.context) return;
    if (this.hooks.onShutdown) {
      await this.hooks.onShutdown(this.context);
    }
    this.initialized = false;
  }

  getManifest(): SkillManifest {
    return this.manifest;
  }

  isEnabled(): boolean {
    return this.manifest.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.manifest.enabled = enabled;
  }
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private context: SkillContext | null = null;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  register(skill: Skill): void {
    if (this.skills.has(skill.manifest.id)) {
      throw new Error(`Skill ${skill.manifest.id} already registered`);
    }
    this.skills.set(skill.manifest.id, skill);
    if (this.context && skill.manifest.enabled) {
      skill.initialize(this.context);
      this.startInterval(skill);
    }
  }

  unregister(id: string): boolean {
    const skill = this.skills.get(id);
    if (!skill) return false;
    
    this.stopInterval(id);
    skill.shutdown();
    this.skills.delete(id);
    return true;
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  getEnabled(): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.manifest.enabled);
  }

  getByCategory(category: SkillManifest['category']): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.manifest.category === category);
  }

  async initializeAll(context: SkillContext): Promise<void> {
    this.context = context;
    for (const skill of this.skills.values()) {
      if (skill.manifest.enabled) {
        try {
          await skill.initialize(context);
          this.startInterval(skill);
        } catch (error) {
          console.error(`Failed to initialize skill ${skill.manifest.id}:`, error);
        }
      }
    }
  }

  async shutdownAll(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.shutdown();
      this.stopInterval(skill.manifest.id);
    }
    this.skills.clear();
    this.context = null;
  }

  async processUserMessage(input: string): Promise<SkillResult[]> {
    if (!this.context) return [];
    
    const results: SkillResult[] = [];
    for (const skill of this.getEnabled()) {
      try {
        const result = await skill.handleUserMessage(input);
        if (result) results.push(result);
      } catch (error) {
        console.error(`Skill ${skill.manifest.id} error on user message:`, error);
      }
    }
    return results;
  }

  async processAssistantResponse(response: string): Promise<SkillResult[]> {
    if (!this.context) return [];
    
    const results: SkillResult[] = [];
    for (const skill of this.getEnabled()) {
      try {
        const result = await skill.handleAssistantResponse(response);
        if (result) results.push(result);
      } catch (error) {
        console.error(`Skill ${skill.manifest.id} error on assistant response:`, error);
      }
    }
    return results;
  }

  async processCommand(command: string, args: string[]): Promise<SkillResult[]> {
    if (!this.context) return [];
    
    const results: SkillResult[] = [];
    for (const skill of this.getEnabled()) {
      try {
        const result = await skill.handleCommand(command, args);
        if (result) results.push(result);
      } catch (error) {
        console.error(`Skill ${skill.manifest.id} error on command:`, error);
      }
    }
    return results;
  }

  private startInterval(skill: Skill): void {
    if (skill.hooks.onInterval) {
      const interval = setInterval(async () => {
        try {
          await skill.handleInterval();
        } catch (error) {
          console.error(`Skill ${skill.manifest.id} interval error:`, error);
        }
      }, 60000);
      this.intervals.set(skill.manifest.id, interval);
    }
  }

  private stopInterval(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  async enableSkill(id: string): Promise<boolean> {
    const skill = this.skills.get(id);
    if (!skill) return false;
    
    skill.setEnabled(true);
    if (this.context) {
      await skill.initialize(this.context);
      this.startInterval(skill);
    }
    return true;
  }

  async disableSkill(id: string): Promise<boolean> {
    const skill = this.skills.get(id);
    if (!skill) return false;
    
    skill.setEnabled(false);
    await skill.shutdown();
    this.stopInterval(id);
    return true;
  }

  async updateSkillConfig(id: string, config: Record<string, any>): Promise<boolean> {
    const skill = this.skills.get(id);
    if (!skill) return false;
    
    await skill.updateConfig(config);
    return true;
  }
}

export const skillRegistry = new SkillRegistry();