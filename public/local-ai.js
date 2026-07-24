// Local AI Engine using Transformers.js
// Runs entirely in browser - no server needed

class LocalAIEngine {
  constructor() {
    this.pipeline = null;
    this.modelId = null;
    this.isLoading = false;
    this.loadProgress = 0;
  }

  // Model configurations - using quantized models from Hugging Face
  static MODELS = {
    'phi-3-mini': {
      modelId: 'Xenova/Phi-3-mini-4k-instruct',
      displayName: 'Phi-3 Mini (Microsoft)',
      size: '2.4 GB',
      contextLength: 4096,
      quantized: true,
    },
    'qwen2-1.5b': {
      modelId: 'Xenova/Qwen2-1.5B-Instruct',
      displayName: 'Qwen2 1.5B (Alibaba)',
      size: '1.2 GB',
      contextLength: 32768,
      quantized: true,
    },
    'smollm-1.7b': {
      modelId: 'Xenova/SmolLM-1.7B-Instruct',
      displayName: 'SmolLM 1.7B (HuggingFace)',
      size: '1.1 GB',
      contextLength: 8192,
      quantized: true,
    },
    'llama-3.2-1b': {
      modelId: 'Xenova/Llama-3.2-1B-Instruct',
      displayName: 'Llama 3.2 1B (Meta)',
      size: '1.3 GB',
      contextLength: 131072,
      quantized: true,
    },
  };

  async loadModel(modelKey, onProgress) {
    if (this.pipeline && this.modelId === modelKey) {
      return true; // Already loaded
    }

    const modelConfig = LocalAIEngine.MODELS[modelKey];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelKey}`);
    }

    this.isLoading = true;
    this.loadProgress = 0;
    this.modelId = modelKey;

    try {
      // Dynamically import Transformers.js
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
      
      // Create text generation pipeline
      this.pipeline = await pipeline('text-generation', modelConfig.modelId, {
        quantized: true,
        progress_callback: (progress) => {
          this.loadProgress = Math.round(progress * 100);
          if (onProgress) onProgress(this.loadProgress / 100);
          if (window.onLocalModelProgress) {
            window.onLocalModelProgress(this.loadProgress / 100);
          }
        },
      });

      this.isLoading = false;
      this.loadProgress = 100;
      
      if (window.onLocalModelLoaded) {
        window.onLocalModelLoaded(modelKey);
      }
      
      return true;
    } catch (error) {
      this.isLoading = false;
      this.pipeline = null;
      throw new Error(`Failed to load ${modelConfig.displayName}: ${error.message}`);
    }
  }

  async generate(prompt, options = {}) {
    if (!this.pipeline) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const {
      temperature = 0.7,
      maxTokens = 512,
      topP = 0.9,
      stream = false,
    } = options;

    try {
      if (stream) {
        // For streaming, we'll generate in chunks
        return this.generateStream(prompt, { temperature, maxTokens, topP });
      } else {
        const output = await this.pipeline(prompt, {
          max_new_tokens: maxTokens,
          temperature,
          top_p: topP,
          do_sample: temperature > 0,
          return_full_text: false,
        });
        
        return {
          text: output[0].generated_text,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      }
    } catch (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  async *generateStream(prompt, options) {
    // Transformers.js doesn't have native streaming yet
    // We'll simulate by generating and yielding chunks
    const output = await this.pipeline(prompt, {
      max_new_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      do_sample: options.temperature > 0,
      return_full_text: false,
    });

    const text = output[0].generated_text;
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const chunk = words.slice(0, i + 1).join(' ') + (i < words.length - 1 ? ' ' : '');
      yield { text: chunk, done: i === words.length - 1 };
      
      // Small delay for visual streaming effect
      await new Promise(r => setTimeout(r, 30));
    }
  }

  formatMessages(messages) {
    // Apply chat template (simplified for Phi-3/Qwen/Llama)
    let prompt = '<|system|>\nYou are AURA, a helpful AI assistant.<|end|>\n';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `<|system|>\n${msg.content}<|end|>\n`;
      } else if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}<|end|>\n`;
      } else if (msg.role === 'assistant') {
        prompt += `<|assistant|>\n${msg.content}<|end|>\n`;
      }
    }
    
    prompt += '<|assistant|>\n';
    return prompt;
  }

  isModelLoaded(modelKey) {
    return this.pipeline !== null && this.modelId === modelKey;
  }

  getLoadedModel() {
    return this.modelId;
  }

  getLoadProgress() {
    return this.loadProgress;
  }

  unload() {
    this.pipeline = null;
    this.modelId = null;
    this.isLoading = false;
    this.loadProgress = 0;
  }
}

// Global instance
window.LocalAIEngine = LocalAIEngine;
window.localAI = new LocalAIEngine();