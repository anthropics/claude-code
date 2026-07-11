export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function apiUrl(endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  const base = (process.env.GITHUB_API_URL || "https://api.github.com").replace(
    /\/$/,
    ""
  );
  return `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

function nextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") {
      const base = new URL(process.env.GITHUB_API_URL || "https://api.github.com");
      const next = new URL(match[1]);
      if (next.origin !== base.origin) {
        throw new Error(`GitHub pagination attempted to change origin to ${next.origin}`);
      }
      return next.toString();
    }
  }
  return null;
}

function withPagination(endpoint: string, page: number): string {
  const base = process.env.GITHUB_API_URL || "https://api.github.com";
  const url = new URL(endpoint, `${base.replace(/\/$/, "")}/`);
  if (!url.searchParams.has("per_page")) url.searchParams.set("per_page", "100");
  url.searchParams.set("page", page.toString());
  return `${url.pathname}${url.search}`;
}

async function request(
  endpoint: string,
  token: string,
  method = "GET",
  body?: unknown
): Promise<Response> {
  const response = await fetch(apiUrl(endpoint), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "claude-code-repository-automation",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new GitHubApiError(
      response.status,
      `GitHub API ${method} ${endpoint} failed: ${response.status} ${
        text || response.statusText
      }`
    );
  }

  return response;
}

export async function githubRequest<T>(
  endpoint: string,
  token: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await request(endpoint, token, method, body);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function githubGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<T> {
  const result = await githubRequest<{
    data?: T;
    errors?: Array<{ message: string }>;
  }>("/graphql", token, "POST", { query, variables });

  if (result.errors?.length || !result.data) {
    const details = result.errors?.map((error) => error.message).join("; ");
    throw new Error(`GitHub GraphQL request failed: ${details || "missing data"}`);
  }

  return result.data;
}

export async function githubPaginate<T>(
  endpoint: string,
  token: string
): Promise<T[]> {
  const items: T[] = [];
  const visited = new Set<string>();
  let page = 1;
  let next: string | null = withPagination(endpoint, page);

  while (next) {
    const canonicalNext = apiUrl(next);
    if (visited.has(canonicalNext)) {
      throw new Error(`GitHub pagination loop detected at ${next}`);
    }
    visited.add(canonicalNext);

    const response = await request(next, token);
    const pageItems = (await response.json()) as T[];
    if (!Array.isArray(pageItems)) {
      throw new Error(`Expected an array from GitHub pagination endpoint ${next}`);
    }
    items.push(...pageItems);

    const linkHeader = response.headers.get("link");
    if (linkHeader !== null) {
      // A Link header without rel="next" is an authoritative final page.
      next = nextLink(linkHeader);
    } else if (pageItems.length === 100) {
      const currentUrl = new URL(next, `${apiUrl("/").replace(/\/$/, "")}/`);
      const currentPage = Number.parseInt(
        currentUrl.searchParams.get("page") || page.toString(),
        10
      );
      page = Number.isSafeInteger(currentPage) ? currentPage + 1 : page + 1;
      next = withPagination(endpoint, page);
    } else {
      next = null;
    }
  }

  return items;
}
