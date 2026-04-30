import type { Issue, TrackerClient, BlockerRef } from '../types.js';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

const FETCH_ISSUES_QUERY = `
  query FetchIssues($projectSlug: String!, $states: [String!]!) {
    issues(
      filter: {
        project: { slug: { eq: $projectSlug } }
        state: { name: { in: $states } }
      }
    ) {
      nodes {
        id
        identifier
        title
        description
        priority
        state { name }
        branchName
        url
        labels { nodes { name } }
        blockedByIssues { nodes { id identifier state { name } } }
        createdAt
        updatedAt
      }
    }
  }
`;

const FETCH_ISSUE_STATES_QUERY = `
  query FetchIssueStates($ids: [ID!]!) {
    issues(filter: { id: { in: $ids } }) {
      nodes {
        id
        state { name }
      }
    }
  }
`;

export class LinearClient implements TrackerClient {
  private apiKey: string;
  private projectSlug: string;
  private endpoint: string;

  constructor(config: { apiKey: string; projectSlug: string; endpoint?: string }) {
    this.apiKey = config.apiKey;
    this.projectSlug = config.projectSlug;
    this.endpoint = config.endpoint ?? LINEAR_API_URL;
  }

  async fetchActiveIssues(states: string[]): Promise<Issue[]> {
    const result = await this.query(FETCH_ISSUES_QUERY, {
      projectSlug: this.projectSlug,
      states,
    });

    return result.data.issues.nodes.map(normalizeIssue);
  }

  async fetchIssueStates(issueIds: string[]): Promise<Map<string, string>> {
    const result = await this.query(FETCH_ISSUE_STATES_QUERY, { ids: issueIds });
    const states = new Map<string, string>();
    
    for (const issue of result.data.issues.nodes) {
      states.set(issue.id, issue.state.name);
    }
    
    return states;
  }

  async fetchTerminalIssues(states: string[]): Promise<Issue[]> {
    // Same query as active but for terminal states
    return this.fetchActiveIssues(states);
  }

  private async query(query: string, variables: Record<string, unknown>): Promise<any> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`);
    }

    return result;
  }
}

function normalizeIssue(raw: any): Issue {
  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description,
    priority: raw.priority,
    state: raw.state?.name ?? 'Unknown',
    branchName: raw.branchName,
    url: raw.url,
    labels: raw.labels?.nodes.map((l: any) => l.name.toLowerCase()) ?? [],
    blockedBy: raw.blockedByIssues?.nodes.map(normalizeBlocker) ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeBlocker(raw: any): BlockerRef {
  return {
    id: raw.id,
    identifier: raw.identifier,
    state: raw.state?.name ?? null,
  };
}
