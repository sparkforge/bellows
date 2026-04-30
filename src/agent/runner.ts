import { createAgentSession, SessionManager, SettingsManager, DefaultResourceLoader } from '@mariozechner/pi-coding-agent';
import type { Issue, Workspace, RunAttempt, LiveSession, WorkflowConfig } from '../types.js';

export interface AgentRunResult {
  success: boolean;
  error?: string;
  output: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
}

export class AgentRunner {
  private config: WorkflowConfig;
  private promptTemplate: string;

  constructor(config: WorkflowConfig, promptTemplate: string) {
    this.config = config;
    this.promptTemplate = promptTemplate;
  }

  async run(
    issue: Issue,
    workspace: Workspace,
    attempt: number,
    abortSignal: AbortSignal
  ): Promise<AgentRunResult> {
    const prompt = this.renderPrompt(issue, workspace);
    
    // TODO: Initialize Pi SDK session
    // This requires:
    // - AuthStorage for API keys
    // - ModelRegistry for model resolution
    // - ResourceLoader for tools
    // - SessionManager for persistence
    
    // For now, stubbed
    console.log(`Would run agent for ${issue.identifier} in ${workspace.path}`);
    console.log(`Prompt length: ${prompt.length} chars`);
    
    return {
      success: true,
      output: 'Stub: Pi SDK integration pending',
      tokens: { input: 0, output: 0, total: 0 },
    };
  }

  private renderPrompt(issue: Issue, workspace: Workspace): string {
    return this.promptTemplate
      .replace(/\{\{issue\.id\}\}/g, issue.id)
      .replace(/\{\{issue\.identifier\}\}/g, issue.identifier)
      .replace(/\{\{issue\.title\}\}/g, issue.title)
      .replace(/\{\{issue\.description\}\}/g, issue.description ?? '')
      .replace(/\{\{issue\.state\}\}/g, issue.state)
      .replace(/\{\{issue\.url\}\}/g, issue.url ?? '')
      .replace(/\{\{workspace\.path\}\}/g, workspace.path)
      .replace(/\{\{workspace\.key\}\}/g, workspace.workspaceKey);
  }
}
