#!/usr/bin/env bun

declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  comments: number;
  user: { id: number; login: string };
  reactions: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

interface GitHubComment {
  id: number;
  body: string;
  created_at: string;
  reactions: {
    total_count: number;
  };
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface IssueAnalysis {
  issueNumber: number;
  title: string;
  shouldLabel: boolean;
  reason: string;
  isBorderline?: boolean;
}

async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: any
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "oncall-triage-groq-script",
      ...(body && { "Content-Type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

async function groqRequest(
  messages: GroqMessage[],
  apiKey: string,
  model: string = 'llama-3.3-70b-versatile'
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Groq API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getRecentlyUpdatedIssues(
  owner: string,
  repo: string,
  token: string,
  daysBack: number = 3
): Promise<GitHubIssue[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  const issues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const pageIssues = await githubRequest<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=desc&per_page=${perPage}&page=${page}`,
      token
    );
    
    if (pageIssues.length === 0) break;
    
    let foundOldIssue = false;
    for (const issue of pageIssues) {
      // Skip pull requests
      if ('pull_request' in issue) continue;
      
      const updatedAt = new Date(issue.updated_at);
      if (updatedAt < cutoffDate) {
        foundOldIssue = true;
        break;
      }
      
      issues.push(issue);
    }
    
    if (foundOldIssue || pageIssues.length < perPage) break;
    page++;
  }
  
  console.log(`Found ${issues.length} issues updated in the last ${daysBack} days`);
  return issues;
}

async function getIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<GitHubComment[]> {
  const comments = await githubRequest<GitHubComment[]>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    token
  );
  return comments;
}

async function analyzeIssueWithGroq(
  issue: GitHubIssue,
  comments: GitHubComment[],
  groqApiKey: string
): Promise<{ shouldLabel: boolean; reason: string; isBorderline: boolean }> {
  // Calculate total engagements
  const commentCount = comments.length;
  const reactionCount = issue.reactions.total_count + 
    comments.reduce((sum, c) => sum + c.reactions.total_count, 0);
  const totalEngagements = commentCount + reactionCount;
  
  // Check if it has bug label
  const hasBugLabel = issue.labels.some(label => 
    label.name.toLowerCase().includes('bug')
  );
  
  // Check if it already has oncall label
  const hasOncallLabel = issue.labels.some(label => 
    label.name.toLowerCase() === 'oncall'
  );
  
  if (hasOncallLabel) {
    return {
      shouldLabel: false,
      reason: 'Already has oncall label',
      isBorderline: false
    };
  }
  
  // Quick filters
  if (!hasBugLabel && !issue.title.toLowerCase().includes('bug') && 
      !issue.body?.toLowerCase().includes('bug')) {
    return {
      shouldLabel: false,
      reason: 'Not identified as a bug',
      isBorderline: false
    };
  }
  
  if (totalEngagements < 50) {
    return {
      shouldLabel: false,
      reason: `Insufficient engagement (${totalEngagements} < 50)`,
      isBorderline: totalEngagements >= 40
    };
  }
  
  // Use Groq to analyze if it's truly blocking
  const issueContent = `
Title: ${issue.title}

Body:
${issue.body || '(no description)'}

Comments (${comments.length}):
${comments.slice(0, 10).map((c, i) => `Comment ${i + 1}: ${c.body.substring(0, 500)}`).join('\n\n')}
${comments.length > 10 ? '\n... (additional comments omitted)' : ''}
  `.trim();
  
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are an expert at triaging GitHub issues to identify critical blocking bugs that require immediate oncall attention.

Analyze the issue and determine if it meets ALL of these criteria:
1. It describes a bug (not a feature request or question)
2. It has sufficient engagement (>= 50 total comments + reactions) [already verified]
3. It is truly BLOCKING - prevents core functionality from working with no reasonable workaround

For criterion 3, look for severity indicators like:
- "crash", "stuck", "frozen", "hang", "unresponsive"
- "cannot use", "blocked", "broken", "unusable"
- Users explicitly stating they are blocked or cannot work

Be CONSERVATIVE. Only flag issues that truly prevent users from getting work done.
Issues with workarounds, minor inconveniences, or cosmetic problems should NOT be labeled.

Respond with ONLY a JSON object in this exact format:
{
  "is_blocking": true/false,
  "reason": "brief explanation of your decision",
  "confidence": "high/medium/low"
}`
    },
    {
      role: 'user',
      content: issueContent
    }
  ];
  
  const response = await groqRequest(messages, groqApiKey);
  
  // Parse the JSON response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      shouldLabel: analysis.is_blocking === true && analysis.confidence !== 'low',
      reason: analysis.reason,
      isBorderline: analysis.is_blocking === true && analysis.confidence === 'low'
    };
  } catch (error) {
    console.error(`Failed to parse Groq response for issue #${issue.number}:`, error);
    console.error('Response was:', response);
    return {
      shouldLabel: false,
      reason: 'Failed to analyze with AI',
      isBorderline: false
    };
  }
}

async function addOncallLabel(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<void> {
  await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    token,
    'POST',
    { labels: ['oncall'] }
  );
  console.log(`✓ Added oncall label to issue #${issueNumber}`);
}

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const groqApiKey = process.env.GROQ_API_KEY;
  const repository = process.env.GITHUB_REPOSITORY;
  
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY environment variable is required');
  }
  
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY environment variable is required');
  }
  
  const [owner, repo] = repository.split('/');
  
  console.log(`Starting oncall triage for ${owner}/${repo}...`);
  console.log('');
  
  // Get recently updated issues
  const issues = await getRecentlyUpdatedIssues(owner, repo, githubToken, 3);
  
  const analyses: IssueAnalysis[] = [];
  let labeled = 0;
  
  // Process each issue
  for (const issue of issues) {
    console.log(`\nEvaluating issue #${issue.number}: ${issue.title}`);
    
    try {
      // Get comments
      const comments = await getIssueComments(owner, repo, issue.number, githubToken);
      
      // Analyze with Groq
      const analysis = await analyzeIssueWithGroq(issue, comments, groqApiKey);
      
      analyses.push({
        issueNumber: issue.number,
        title: issue.title,
        shouldLabel: analysis.shouldLabel,
        reason: analysis.reason,
        isBorderline: analysis.isBorderline
      });
      
      if (analysis.shouldLabel) {
        await addOncallLabel(owner, repo, issue.number, githubToken);
        labeled++;
      } else {
        console.log(`  → Skip: ${analysis.reason}`);
      }
      
      // Rate limiting: wait a bit between issues
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Error processing issue #${issue.number}:`, error);
      analyses.push({
        issueNumber: issue.number,
        title: issue.title,
        shouldLabel: false,
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('ONCALL TRIAGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal issues evaluated: ${analyses.length}`);
  console.log(`Issues labeled with 'oncall': ${labeled}`);
  
  if (labeled > 0) {
    console.log('\n📍 Issues that received the oncall label:');
    analyses
      .filter(a => a.shouldLabel)
      .forEach(a => {
        console.log(`  - #${a.issueNumber}: ${a.title}`);
        console.log(`    Reason: ${a.reason}`);
      });
  }
  
  const borderline = analyses.filter(a => a.isBorderline && !a.shouldLabel);
  if (borderline.length > 0) {
    console.log('\n⚠️  Close calls (borderline cases that did not qualify):');
    borderline.forEach(a => {
      console.log(`  - #${a.issueNumber}: ${a.title}`);
      console.log(`    Reason: ${a.reason}`);
    });
  }
  
  if (labeled === 0) {
    console.log('\n✓ No critical blocking issues requiring oncall attention were found.');
  }
  
  console.log('');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
