import { ModelRoute } from '../shared/types';

export interface ModelProvider {
  name: string;
  generate(prompt: string, options: GenerationOptions): Promise<string>;
  getCapabilities(): ModelCapability[];
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: any[];
}

export interface ModelCapability {
  name: string;
  maxContextTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kTokens?: number;
  latencyMs?: number;
}

export class ModelRouter {
  private providers: Map<string, ModelProvider> = new Map();
  private routes: Map<string, ModelRoute> = new Map();

  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  addRoute(route: ModelRoute): void {
    this.routes.set(route.taskType, route);
  }

  async generate(taskType: string, prompt: string, options: GenerationOptions = {}): Promise<string> {
    const route = this.routes.get(taskType);
    if (!route) {
      const defaultProvider = this.providers.values().next().value;
      if (!defaultProvider) throw new Error('No model providers available');
      return defaultProvider.generate(prompt, options);
    }

    const provider = this.providers.get(route.preferredModel);
    if (provider) {
      try {
        return await provider.generate(prompt, options);
      } catch (error) {
        for (const fallback of route.fallbackModels) {
          const fallbackProvider = this.providers.get(fallback);
          if (fallbackProvider) {
            try {
              return await fallbackProvider.generate(prompt, options);
            } catch {}
          }
        }
        throw error;
      }
    }

    for (const fallback of route.fallbackModels) {
      const fallbackProvider = this.providers.get(fallback);
      if (fallbackProvider) {
        return fallbackProvider.generate(prompt, options);
      }
    }

    throw new Error(`No available model for task type: ${taskType}`);
  }

  getRoute(taskType: string): ModelRoute | undefined {
    return this.routes.get(taskType);
  }

  getAvailableModels(): string[] {
    return Array.from(this.providers.keys());
  }
}

export class OpenRouterProvider implements ModelProvider {
  name = 'openrouter';
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AURA Unified Intelligence Platform'
      },
      body: JSON.stringify({
        model: options.systemPrompt ? 'nvidia/nemotron-3-ultra-550b-a55b:free' : 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [
          ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  getCapabilities(): ModelCapability[] {
    return [{
      name: 'nemotron-3-ultra',
      maxContextTokens: 128000,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 2000
    }];
  }
}

export class LocalModelProvider implements ModelProvider {
  name = 'local';
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:11434') {
    this.endpoint = endpoint;
  }

  async generate(prompt: string, options: GenerationOptions = {}): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nemotron-3-ultra',
        prompt,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Local model error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  getCapabilities(): ModelCapability[] {
    return [{
      name: 'local-nemotron',
      maxContextTokens: 32000,
      supportsTools: false,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 5000
    }];
  }
}