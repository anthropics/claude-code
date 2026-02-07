#!/usr/bin/env python3
"""
Oncall Issue Triage using GroqCloud API
This script identifies critical issues that need oncall attention using Groq's LLM API.
"""

import os
import sys
import json
import time
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
import requests

# Configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # Using Llama 3.3 70B for better reasoning

if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY environment variable is required")
    sys.exit(1)

if not GITHUB_TOKEN:
    print("Error: GITHUB_TOKEN environment variable is required")
    sys.exit(1)

if not GITHUB_REPOSITORY:
    print("Error: GITHUB_REPOSITORY environment variable is required")
    sys.exit(1)

# Parse repository owner and name
try:
    owner, repo = GITHUB_REPOSITORY.split("/")
except ValueError:
    print(f"Error: GITHUB_REPOSITORY must be in 'owner/repo' format, got: {GITHUB_REPOSITORY}")
    sys.exit(1)


def github_api_request(endpoint: str, method: str = "GET", data: Dict = None) -> Any:
    """Make a request to GitHub API"""
    url = f"https://api.github.com/{endpoint}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 403:
            print(f"GitHub API rate limit exceeded or forbidden: {e}")
        elif e.response.status_code == 404:
            print(f"GitHub API resource not found: {e}")
        else:
            print(f"GitHub API error: {e}")
        raise


def get_recent_issues(days: int = 3, max_pages: int = 10) -> List[Dict]:
    """Fetch issues updated in the last N days"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    issues = []
    page = 1
    
    print(f"Fetching open issues updated in the last {days} days...")
    
    while page <= max_pages:
        endpoint = f"repos/{owner}/{repo}/issues"
        params = f"?state=open&sort=updated&direction=desc&per_page=100&page={page}"
        
        page_issues = github_api_request(endpoint + params)
        
        if not page_issues:
            break
        
        for issue in page_issues:
            # Skip pull requests
            if "pull_request" in issue:
                continue
                
            updated_at = datetime.strptime(issue["updated_at"], "%Y-%m-%dT%H:%M:%SZ")
            
            if updated_at < cutoff_date:
                print(f"Reached issues older than {days} days, stopping pagination")
                return issues
            
            issues.append(issue)
        
        page += 1
    
    print(f"Found {len(issues)} candidate issues")
    return issues


def get_issue_comments(issue_number: int) -> List[Dict]:
    """Fetch all comments for an issue"""
    endpoint = f"repos/{owner}/{repo}/issues/{issue_number}/comments"
    return github_api_request(endpoint)


def get_user_login(comment: Dict) -> str:
    """Safely extract user login from comment, handling deleted users"""
    user = comment.get('user')
    if not user:
        return 'deleted'
    return user.get('login', 'unknown')


def count_reactions(reactions: Dict) -> int:
    """Count total reactions from a reactions dict"""
    if not reactions:
        return 0
    return sum([
        reactions.get("+1", 0),
        reactions.get("-1", 0),
        reactions.get("laugh", 0),
        reactions.get("hooray", 0),
        reactions.get("confused", 0),
        reactions.get("heart", 0),
        reactions.get("rocket", 0),
        reactions.get("eyes", 0)
    ])


def count_engagements(issue: Dict, comments: List[Dict]) -> int:
    """Count total engagements (comments + reactions)"""
    total = len(comments)
    
    # Count reactions on the issue
    total += count_reactions(issue.get("reactions"))
    
    # Count reactions on comments
    for comment in comments:
        total += count_reactions(comment.get("reactions"))
    
    return total


def call_groq_api(messages: List[Dict[str, str]]) -> str:
    """Call Groq API for LLM reasoning"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2000,
    }
    
    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print(f"Groq API rate limit exceeded: {e}")
        elif e.response.status_code == 401:
            print(f"Groq API authentication failed: {e}")
        else:
            print(f"Groq API error: {e}")
        raise
    except KeyError as e:
        print(f"Unexpected Groq API response format: {e}")
        raise


def analyze_issue_with_groq(issue: Dict, comments: List[Dict]) -> Dict[str, Any]:
    """Use Groq LLM to analyze if an issue needs oncall attention"""
    
    # Prepare issue content
    issue_text = f"""Issue #{issue['number']}: {issue['title']}

Body:
{issue['body'] or 'No description provided'}

Labels: {', '.join([label['name'] for label in issue['labels']])}

Comments ({len(comments)} total):
"""
    
    # Add recent comments (last 5)
    for comment in comments[-5:]:
        user_login = get_user_login(comment)
        body = comment.get('body', '')
        if body:
            issue_text += f"\n- {user_login}: {body[:200]}..."
    
    # Create prompt for Groq
    prompt = f"""You are an oncall triage assistant. Analyze this GitHub issue and determine if it needs immediate oncall attention.

{issue_text}

An issue qualifies for oncall label if it meets ALL these criteria:
1. It's a bug (has "bug" label or describes bug behavior)
2. It has at least 50 engagements (comments + reactions)
3. It's truly blocking (prevents core functionality, users can't work around it)

Blocking severity indicators: "crash", "stuck", "frozen", "hang", "unresponsive", "cannot use", "blocked", "broken"

Be conservative - only flag truly critical issues that prevent users from working.

Respond ONLY with a JSON object in this exact format:
{{
  "needs_oncall": true/false,
  "reason": "brief explanation of your decision",
  "is_bug": true/false,
  "is_blocking": true/false
}}"""

    messages = [
        {"role": "system", "content": "You are a technical triage assistant. Respond only with valid JSON."},
        {"role": "user", "content": prompt}
    ]
    
    response = call_groq_api(messages)
    
    # Parse JSON response
    try:
        # Try to extract JSON from the response
        response = response.strip()
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "```" in response:
            response = response.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response)
        return result
    except json.JSONDecodeError as e:
        print(f"Failed to parse Groq response: {response}")
        print(f"Error: {e}")
        return {"needs_oncall": False, "reason": "Failed to parse response", "is_bug": False, "is_blocking": False}


def add_oncall_label(issue_number: int) -> bool:
    """Add oncall label to an issue"""
    try:
        endpoint = f"repos/{owner}/{repo}/issues/{issue_number}/labels"
        github_api_request(endpoint, method="POST", data={"labels": ["oncall"]})
        return True
    except Exception as e:
        print(f"Failed to add oncall label to issue #{issue_number}: {e}")
        return False


def main():
    print(f"Starting oncall triage for {GITHUB_REPOSITORY}")
    print(f"Using Groq model: {GROQ_MODEL}")
    print("=" * 80)
    
    # Fetch recent issues
    issues = get_recent_issues(days=3)
    
    if not issues:
        print("No issues to process")
        return
    
    processed_count = 0
    labeled_count = 0
    labeled_issues = []
    close_calls = []
    
    for issue in issues:
        issue_number = issue["number"]
        print(f"\nProcessing issue #{issue_number}: {issue['title']}")
        
        # Check if already has oncall label
        labels = [label["name"] for label in issue["labels"]]
        if "oncall" in labels:
            print(f"  Already has oncall label, skipping")
            continue
        
        # Check if it's a bug - check exact label match and case-insensitive title/body
        has_bug_label = any(label.lower() == "bug" for label in labels)
        title_lower = issue["title"].lower()
        body_lower = (issue["body"] or "").lower()
        
        # Look for bug-related terms (as whole words)
        # Including common indicators: bug, defect, error, crash, failure
        bug_pattern = r'\b(bug|defect|error|crash|failure)\b'
        has_bug_mention = has_bug_label or bool(re.search(bug_pattern, title_lower)) or bool(re.search(bug_pattern, body_lower))
        
        if not has_bug_mention:
            print(f"  Not a bug, skipping")
            continue
        
        # Get comments
        comments = get_issue_comments(issue_number)
        
        # Count engagements
        engagements = count_engagements(issue, comments)
        print(f"  Engagements: {engagements}")
        
        if engagements < 50:
            print(f"  Not enough engagements (need 50+), skipping")
            continue
        
        # Analyze with Groq
        print(f"  Analyzing with Groq...")
        analysis = analyze_issue_with_groq(issue, comments)
        
        processed_count += 1
        
        print(f"  Analysis: {analysis['reason']}")
        print(f"  Is bug: {analysis['is_bug']}, Is blocking: {analysis['is_blocking']}, Needs oncall: {analysis['needs_oncall']}")
        
        if analysis["needs_oncall"]:
            print(f"  ✓ Adding oncall label")
            if add_oncall_label(issue_number):
                labeled_count += 1
                labeled_issues.append({
                    "number": issue_number,
                    "title": issue["title"],
                    "reason": analysis["reason"]
                })
        else:
            if engagements >= 50 and analysis["is_bug"]:
                close_calls.append({
                    "number": issue_number,
                    "title": issue["title"],
                    "reason": analysis["reason"]
                })
        
        # Rate limiting
        time.sleep(1)
    
    # Print summary
    print("\n" + "=" * 80)
    print("ONCALL TRIAGE SUMMARY")
    print("=" * 80)
    print(f"Total candidate issues evaluated: {processed_count}")
    print(f"Issues that received oncall label: {labeled_count}")
    
    if labeled_issues:
        print("\nIssues labeled with 'oncall':")
        for item in labeled_issues:
            print(f"  - #{item['number']}: {item['title']}")
            print(f"    Reason: {item['reason']}")
    
    if close_calls:
        print("\nClose calls (didn't quite meet criteria):")
        for item in close_calls:
            print(f"  - #{item['number']}: {item['title']}")
            print(f"    Reason: {item['reason']}")
    
    if not labeled_issues and not close_calls:
        print("\nNo issues qualified for oncall label.")
    
    print("\nTriage complete!")


if __name__ == "__main__":
    main()
