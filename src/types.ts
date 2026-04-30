// Bellows — Core types for Pi-native agent orchestration

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  state: string;
  branchName: string | null;
  url: string | null;
  labels: string[];
  blockedBy: BlockerRef[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BlockerRef {
  id: string | null;
  identifier: string | null;
  state: string | null;
}

export interface WorkflowConfig {
  tracker: TrackerConfig;
  polling?: PollingConfig;
  workspace?: WorkspaceConfig;
  agent?: AgentConfig;
  pi?: PiConfig;
  hooks?: HooksConfig;
}

export interface TrackerConfig {
  kind: 'linear' | 'github';
  endpoint?: string;
  apiKey: string;
  projectSlug?: string;
  activeStates: string[];
  terminalStates: string[];
}

export interface PollingConfig {
  intervalMs: number;
}

export interface WorkspaceConfig {
  root: string;
  hooks?: HooksConfig;
}

export interface AgentConfig {
  maxConcurrentAgents: number;
  maxTurns: number;
  maxRetryBackoffMs: number;
  maxConcurrentAgentsByState?: Record<string, number>;
}

export interface PiConfig {
  model: string;
  provider: string;
  thinkingLevel?: 'off' | 'on' | 'hidden';
  timeoutMs?: number;
}

export interface HooksConfig {
  afterCreate?: string;
  beforeRun?: string;
  afterRun?: string;
  beforeRemove?: string;
  timeoutMs?: number;
}

export interface WorkflowDefinition {
  config: WorkflowConfig;
  promptTemplate: string;
}

export interface Workspace {
  path: string;
  workspaceKey: string;
  createdNow: boolean;
}

export interface RunAttempt {
  issueId: string;
  issueIdentifier: string;
  attempt: number | null;
  workspacePath: string;
  startedAt: string;
  status: 'running' | 'success' | 'failure' | 'timeout' | 'cancelled';
  error?: string;
}

export interface LiveSession {
  sessionId: string;
  threadId: string;
  turnId: string;
  turnCount: number;
  lastEvent: string | null;
  lastTimestamp: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface RetryEntry {
  issueId: string;
  identifier: string;
  attempt: number;
  dueAt: number;
  error: string | null;
}

export interface OrchestratorState {
  pollIntervalMs: number;
  maxConcurrentAgents: number;
  running: Map<string, RunningEntry>;
  claimed: Set<string>;
  retryAttempts: Map<string, RetryEntry>;
  completed: Set<string>;
  piTotals: PiTotals;
}

export interface RunningEntry {
  issueId: string;
  attempt: RunAttempt;
  session: LiveSession;
  abortController: AbortController;
}

export interface PiTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  runtimeSeconds: number;
}

export interface TrackerClient {
  fetchActiveIssues(): Promise<Issue[]>;
  fetchIssueStates(issueIds: string[]): Promise<Map<string, string>>;
  fetchTerminalIssues(): Promise<Issue[]>;
}
