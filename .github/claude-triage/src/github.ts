import { Octokit } from "@octokit/rest";

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  created_at: string;
  html_url: string;
  user: string | null;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged_at: string | null;
  created_at: string;
  html_url: string;
  user: string | null;
}

export interface RecentItems {
  issues: GitHubIssue[];
  pullRequests: GitHubPR[];
}

export interface DuplicateCandidate {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
}

export function createClient(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");
  return new Octokit({ auth: token });
}

export async function fetchIssue(
  client: Octokit,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubIssue> {
  const { data } = await client.issues.get({ owner, repo, issue_number: number });
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    state: data.state,
    labels: (data.labels ?? []).map((l) =>
      typeof l === "string" ? l : (l.name ?? "")
    ),
    created_at: data.created_at,
    html_url: data.html_url,
    user: data.user?.login ?? null,
  };
}

export async function fetchRecentItems(
  client: Octokit,
  owner: string,
  repo: string,
  days: number
): Promise<RecentItems> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch issues (excluding PRs)
  const issuePages = await client.paginate(client.issues.listForRepo, {
    owner,
    repo,
    state: "all",
    since,
    per_page: 100,
  });

  const issues: GitHubIssue[] = issuePages
    .filter((item) => !item.pull_request)
    .map((item) => ({
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      state: item.state,
      labels: (item.labels ?? []).map((l) =>
        typeof l === "string" ? l : (l.name ?? "")
      ),
      created_at: item.created_at,
      html_url: item.html_url,
      user: item.user?.login ?? null,
    }));

  // Fetch PRs
  const prPages = await client.paginate(client.pulls.list, {
    owner,
    repo,
    state: "all",
    per_page: 100,
  });

  const cutoff = new Date(since);
  const pullRequests: GitHubPR[] = prPages
    .filter((pr) => new Date(pr.created_at) >= cutoff)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body ?? null,
      state: pr.state,
      merged_at: pr.merged_at ?? null,
      created_at: pr.created_at,
      html_url: pr.html_url,
      user: pr.user?.login ?? null,
    }));

  return { issues, pullRequests };
}

export async function searchDuplicates(
  client: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string | null
): Promise<DuplicateCandidate[]> {
  // Build search query from title keywords (strip special chars for GH search)
  const keywords = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join(" ");

  const query = `repo:${owner}/${repo} is:issue ${keywords}`;

  const { data } = await client.search.issuesAndPullRequests({
    q: query,
    per_page: 5,
  });

  return data.items
    .filter((item) => !("pull_request" in item))
    .map((item) => ({
      number: item.number,
      title: item.title,
      html_url: item.html_url,
      state: item.state,
      created_at: item.created_at,
    }));
}

export async function addLabels(
  client: Octokit,
  owner: string,
  repo: string,
  number: number,
  labels: string[]
): Promise<void> {
  if (labels.length === 0) return;
  await client.issues.addLabels({ owner, repo, issue_number: number, labels });
}

export async function postComment(
  client: Octokit,
  owner: string,
  repo: string,
  number: number,
  body: string
): Promise<void> {
  await client.issues.createComment({ owner, repo, issue_number: number, body });
}
