import type { 
  Issue, 
  WorkflowConfig, 
  OrchestratorState, 
  RunningEntry, 
  RetryEntry,
  TrackerClient 
} from './types.js';
import { WorkspaceManager } from './workspace/manager.js';
import { AgentRunner } from './agent/runner.js';

export interface OrchestratorOptions {
  config: WorkflowConfig;
  promptTemplate: string;
  tracker: TrackerClient;
}

export class Orchestrator {
  private config: WorkflowConfig;
  private promptTemplate: string;
  private tracker: TrackerClient;
  private workspaceManager: WorkspaceManager;
  private agentRunner: AgentRunner;
  private state: OrchestratorState;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.promptTemplate = options.promptTemplate;
    this.tracker = options.tracker;
    
    this.workspaceManager = new WorkspaceManager({
      root: this.config.workspace?.root ?? './workspaces',
      hooks: this.config.workspace?.hooks,
    });
    
    this.agentRunner = new AgentRunner(this.config, this.promptTemplate);
    
    this.state = {
      pollIntervalMs: this.config.polling?.intervalMs ?? 30000,
      maxConcurrentAgents: this.config.agent?.maxConcurrentAgents ?? 10,
      running: new Map(),
      claimed: new Set(),
      retryAttempts: new Map(),
      completed: new Set(),
      piTotals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, runtimeSeconds: 0 },
    };
  }

  start(): void {
    console.log('Bellows orchestrator starting...');
    console.log(`Poll interval: ${this.state.pollIntervalMs}ms`);
    console.log(`Max concurrent: ${this.state.maxConcurrentAgents}`);
    
    // Initial poll
    this.poll();
    
    // Schedule recurring polls
    this.pollTimer = setInterval(() => this.poll(), this.state.pollIntervalMs);
  }

  stop(): void {
    console.log('Bellows orchestrator stopping...');
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    // Cancel all running sessions
    for (const entry of this.state.running.values()) {
      entry.abortController.abort();
    }
  }

  private async poll(): Promise<void> {
    try {
      const activeStates = this.config.tracker!.activeStates;
      const issues = await this.tracker.fetchActiveIssues(activeStates);
      
      console.log(`Poll: found ${issues.length} active issues`);
      
      // Filter to eligible issues (not blocked, not already running, not in retry)
      const eligible = issues.filter(issue => this.isEligible(issue));
      
      // Sort by priority (lower = higher priority)
      eligible.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
      
      // Dispatch up to available slots
      const availableSlots = this.state.maxConcurrentAgents - this.state.running.size;
      const toDispatch = eligible.slice(0, availableSlots);
      
      for (const issue of toDispatch) {
        this.dispatch(issue);
      }
      
      // Check retry queue
      this.processRetries();
      
      // Reconcile running sessions (check if issues still active)
      await this.reconcile();
      
    } catch (error) {
      console.error('Poll failed:', error);
    }
  }

  private isEligible(issue: Issue): boolean {
    // Skip if already running
    if (this.state.running.has(issue.id)) return false;
    
    // Skip if claimed (running or retrying)
    if (this.state.claimed.has(issue.id)) return false;
    
    // Skip if blocked
    if (issue.blockedBy.some(b => !b.state || !this.isTerminalState(b.state))) return false;
    
    return true;
  }

  private isTerminalState(state: string): boolean {
    const terminal = this.config.tracker!.terminalStates.map(s => s.toLowerCase());
    return terminal.includes(state.toLowerCase());
  }

  private async dispatch(issue: Issue): Promise<void> {
    console.log(`Dispatching ${issue.identifier}: ${issue.title}`);
    
    this.state.claimed.add(issue.id);
    
    const abortController = new AbortController();
    
    try {
      const workspace = await this.workspaceManager.getOrCreateWorkspace(issue.identifier);
      await this.workspaceManager.prepareForRun(workspace.path);
      
      // TODO: Create actual Pi session and run
      // For now, just log
      console.log(`Would run agent for ${issue.identifier}`);
      
      // Mark as running (stub)
      this.state.running.set(issue.id, {
        issueId: issue.id,
        attempt: {
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          attempt: null,
          workspacePath: workspace.path,
          startedAt: new Date().toISOString(),
          status: 'running',
        },
        session: {
          sessionId: `stub-${Date.now()}`,
          threadId: `thread-${issue.id}`,
          turnId: 'turn-1',
          turnCount: 0,
          lastEvent: null,
          lastTimestamp: null,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        abortController,
      });
      
    } catch (error) {
      console.error(`Failed to dispatch ${issue.identifier}:`, error);
      this.state.claimed.delete(issue.id);
      this.scheduleRetry(issue, error);
    }
  }

  private scheduleRetry(issue: Issue, error: unknown): void {
    const existing = this.state.retryAttempts.get(issue.id);
    const attempt = (existing?.attempt ?? 0) + 1;
    const backoffMs = Math.min(
      1000 * Math.pow(2, attempt), // Exponential backoff
      this.config.agent?.maxRetryBackoffMs ?? 300000
    );
    
    const retry: RetryEntry = {
      issueId: issue.id,
      identifier: issue.identifier,
      attempt,
      dueAt: Date.now() + backoffMs,
      error: error instanceof Error ? error.message : String(error),
    };
    
    this.state.retryAttempts.set(issue.id, retry);
    this.state.claimed.add(issue.id);
    
    console.log(`Scheduled retry for ${issue.identifier} in ${backoffMs}ms (attempt ${attempt})`);
  }

  private processRetries(): void {
    const now = Date.now();
    
    for (const [issueId, retry] of this.state.retryAttempts) {
      if (retry.dueAt <= now) {
        console.log(`Retry ${retry.identifier} is due`);
        this.state.retryAttempts.delete(issueId);
        this.state.claimed.delete(issueId);
        // Will be picked up on next poll if still eligible
      }
    }
  }

  private async reconcile(): Promise<void> {
    if (this.state.running.size === 0) return;
    
    const issueIds = Array.from(this.state.running.keys());
    const states = await this.tracker.fetchIssueStates(issueIds);
    
    for (const [issueId, state] of states) {
      if (this.isTerminalState(state)) {
        console.log(`Issue ${issueId} moved to terminal state ${state}, stopping`);
        const entry = this.state.running.get(issueId);
        if (entry) {
          entry.abortController.abort();
          this.state.running.delete(issueId);
          this.state.claimed.delete(issueId);
        }
      }
    }
  }

  getStatus(): OrchestratorState {
    return this.state;
  }
}
