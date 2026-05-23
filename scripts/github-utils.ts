export interface GitHubIssue {
  number: number;
  title: string;
  user: { id: number };
  created_at: string;
  state?: string;
  state_reason?: string;
  closed_at?: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  user: { type: string; id: number };
}

export interface GitHubReaction {
  user: { id: number };
  content: string;
}

/**
 * Common GitHub API request utility
 */
export async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: any,
  userAgent: string = 'claude-code-scripts',
  baseUrl: string = 'https://api.github.com'
): Promise<T> {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": userAgent,
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText}`
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
