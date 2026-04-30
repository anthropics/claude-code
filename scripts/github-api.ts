export interface GitHubIssue {
  number: number;
  title: string;
  state?: string;
  state_reason?: string;
  user: { id: number };
  created_at: string;
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

export async function githubRequest<T>(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN required");

  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "claude-code-scripts",
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

export async function paginateAll<T>(endpoint: string, maxPages = 50): Promise<T[]> {
  const all: T[] = [];
  const sep = endpoint.includes("?") ? "&" : "?";
  for (let page = 1; page <= maxPages; page++) {
    const items = await githubRequest<T[]>(`${endpoint}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
  }
  return all;
}

export function getRepoConfig(): { owner: string; repo: string } {
  return {
    owner: process.env.GITHUB_REPOSITORY_OWNER ?? "anthropics",
    repo: process.env.GITHUB_REPOSITORY_NAME ?? "claude-code",
  };
}
