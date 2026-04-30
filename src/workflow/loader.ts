import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import yaml from 'js-yaml';
import type { WorkflowDefinition, WorkflowConfig } from '../types.js';

const DEFAULT_CONFIG: Partial<WorkflowConfig> = {
  polling: { intervalMs: 30000 },
  agent: {
    maxConcurrentAgents: 10,
    maxTurns: 20,
    maxRetryBackoffMs: 300000,
  },
  workspace: { root: './workspaces' },
};

export async function loadWorkflow(path: string = './WORKFLOW.md'): Promise<WorkflowDefinition> {
  if (!existsSync(path)) {
    throw new Error(`Workflow file not found: ${path}`);
  }

  const content = await readFile(path, 'utf-8');
  return parseWorkflow(content);
}

export function parseWorkflow(content: string): WorkflowDefinition {
  const trimmed = content.trim();
  
  // Check for YAML front matter
  if (trimmed.startsWith('---')) {
    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex === -1) {
      throw new Error('Workflow file has unclosed YAML front matter');
    }
    
    const yamlContent = trimmed.slice(3, endIndex).trim();
    const promptTemplate = trimmed.slice(endIndex + 3).trim();
    
    const parsed = yaml.load(yamlContent);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Workflow YAML front matter must be an object');
    }
    
    const config = mergeWithDefaults(parsed as Partial<WorkflowConfig>);
    validateConfig(config);
    
    return { config, promptTemplate };
  }
  
  // No front matter — entire file is prompt
  return { 
    config: DEFAULT_CONFIG as WorkflowConfig, 
    promptTemplate: trimmed 
  };
}

function mergeWithDefaults(userConfig: Partial<WorkflowConfig>): WorkflowConfig {
  return {
    tracker: userConfig.tracker!,
    polling: { ...DEFAULT_CONFIG.polling!, ...userConfig.polling },
    agent: { ...DEFAULT_CONFIG.agent!, ...userConfig.agent },
    workspace: { ...DEFAULT_CONFIG.workspace!, ...userConfig.workspace },
    pi: userConfig.pi,
    hooks: userConfig.hooks,
  };
}

function validateConfig(config: WorkflowConfig): void {
  if (!config.tracker) {
    throw new Error('Workflow config must specify tracker');
  }
  if (!config.tracker.kind) {
    throw new Error('Tracker config must specify kind');
  }
  if (!config.tracker.apiKey) {
    throw new Error('Tracker config must specify apiKey');
  }
  if (!config.tracker.activeStates?.length) {
    throw new Error('Tracker config must specify activeStates');
  }
  if (!config.tracker.terminalStates?.length) {
    throw new Error('Tracker config must specify terminalStates');
  }
}
