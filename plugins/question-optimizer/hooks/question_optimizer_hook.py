#!/usr/bin/env python3
"""
Question Optimizer Hook for Claude Code
Detects simple questions and follow-up queries to suggest faster model usage.

Detection Logic:
1. Check if input starts with question word (Who, What, When, etc.)
2. Check if input contains a subject
3. Check if input contains a main verb
4. Check if input ends with '?'
If 3/4 conditions met -> likely a question

For questions:
- Compare with recent conversation history
- If 3+ non-article words match -> follow-up question (use fast model)
- If < 3 matches -> new question (normal model)
"""

import json
import os
import sys
import re
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/question-optimizer-log.txt"

# Question indicators (not case sensitive)
QUESTION_STARTERS = {
    "who", "whom", "what", "which", "when", "where", "why", "whose", "how",
    "are", "is", "do", "did", "was", "were", "have", "has", "had",
    "can", "could", "will", "would", "shall", "should", "may", "might"
}

# Common articles and stop words to exclude from comparison
ARTICLES_AND_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "of", "to", "in", "on", "at", "for",
    "with", "from", "by", "about", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "under", "i", "you",
    "we", "they", "he", "she", "it", "this", "that", "these", "those"
}

# Common verbs (simplified list for subject-verb detection)
COMMON_VERBS = {
    "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did",
    "can", "could", "will", "would", "shall", "should", "may", "might",
    "go", "get", "make", "take", "see", "know", "think", "come", "want",
    "use", "find", "give", "tell", "work", "call", "try", "ask", "need",
    "feel", "become", "leave", "put", "mean", "keep", "let", "begin",
    "seem", "help", "talk", "turn", "start", "show", "hear", "play",
    "run", "move", "like", "live", "believe", "hold", "bring", "happen",
    "write", "provide", "sit", "stand", "lose", "pay", "meet", "include",
    "create", "build", "edit", "change", "update", "delete", "add", "remove"
}


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def get_conversation_history_file(session_id):
    """Get session-specific conversation history file path."""
    return os.path.expanduser(f"~/.claude/question_optimizer_history_{session_id}.json")


def load_conversation_history(session_id):
    """Load recent conversation history (last 5 messages)."""
    history_file = get_conversation_history_file(session_id)
    if os.path.exists(history_file):
        try:
            with open(history_file, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_conversation_history(session_id, history):
    """Save conversation history (keep only last 5 messages)."""
    history_file = get_conversation_history_file(session_id)
    try:
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        # Keep only last 5 messages
        recent_history = history[-5:] if len(history) > 5 else history
        with open(history_file, "w") as f:
            json.dump(recent_history, f)
    except IOError:
        pass  # Fail silently


def tokenize_and_normalize(text):
    """
    Tokenize text and return normalized words (lowercase, no punctuation).
    Excludes articles and common stop words.
    """
    # Remove punctuation and convert to lowercase
    words = re.findall(r'\b[a-z]+\b', text.lower())
    # Filter out articles and stop words
    return [w for w in words if w not in ARTICLES_AND_STOPWORDS and len(w) > 2]


def check_question_conditions(text):
    """
    Check the 4 conditions for question detection:
    1. Starts with question word
    2. Contains a subject (noun/pronoun)
    3. Contains a main verb
    4. Ends with '?'

    Returns (is_question: bool, conditions_met: int, details: dict)
    """
    conditions_met = 0
    details = {}

    # Normalize text
    text_lower = text.lower().strip()
    words = text_lower.split()

    if not words:
        return False, 0, details

    # Condition 1: Starts with question word
    first_word = words[0].strip('?,.:;!')
    if first_word in QUESTION_STARTERS:
        conditions_met += 1
        details['starts_with_question_word'] = True
        debug_log(f"✓ Condition 1: Starts with question word '{first_word}'")
    else:
        details['starts_with_question_word'] = False
        debug_log(f"✗ Condition 1: Does not start with question word (first word: '{first_word}')")

    # Condition 2: Contains a subject (simple heuristic: noun after question word or pronoun)
    # Look for pronouns or capitalized words (potential nouns) or common subjects
    has_subject = False
    subject_indicators = {'i', 'you', 'we', 'they', 'he', 'she', 'it', 'this', 'that',
                         'file', 'code', 'project', 'application', 'system', 'plugin',
                         'function', 'method', 'class', 'variable', 'data', 'user',
                         'server', 'database', 'api', 'interface', 'component'}

    for word in words:
        clean_word = word.strip('?,.:;!')
        if clean_word in subject_indicators or (len(clean_word) > 2 and clean_word[0].isupper()):
            has_subject = True
            break

    if has_subject:
        conditions_met += 1
        details['has_subject'] = True
        debug_log(f"✓ Condition 2: Contains a subject")
    else:
        details['has_subject'] = False
        debug_log(f"✗ Condition 2: No clear subject found")

    # Condition 3: Contains a main verb
    has_verb = False
    for word in words:
        clean_word = word.strip('?,.:;!')
        if clean_word in COMMON_VERBS:
            has_verb = True
            break

    if has_verb:
        conditions_met += 1
        details['has_verb'] = True
        debug_log(f"✓ Condition 3: Contains a verb")
    else:
        details['has_verb'] = False
        debug_log(f"✗ Condition 3: No verb found")

    # Condition 4: Ends with '?'
    if text.strip().endswith('?'):
        conditions_met += 1
        details['ends_with_question_mark'] = True
        debug_log(f"✓ Condition 4: Ends with '?'")
    else:
        details['ends_with_question_mark'] = False
        debug_log(f"✗ Condition 4: Does not end with '?'")

    is_question = conditions_met >= 3
    debug_log(f"Question detection: {conditions_met}/4 conditions met -> {'QUESTION' if is_question else 'NOT A QUESTION'}")

    return is_question, conditions_met, details


def count_matching_words(current_text, history):
    """
    Count how many non-article words from current_text appear in recent history.
    Returns (match_count, is_follow_up)
    """
    current_words = set(tokenize_and_normalize(current_text))

    if not current_words:
        return 0, False

    debug_log(f"Current text normalized words: {current_words}")

    # Combine recent history into one text
    history_text = " ".join(history)
    history_words = set(tokenize_and_normalize(history_text))

    debug_log(f"History normalized words: {history_words}")

    # Count matching words
    matching_words = current_words.intersection(history_words)
    match_count = len(matching_words)

    debug_log(f"Matching words ({match_count}): {matching_words}")

    # 3 or more matching non-article words = follow-up
    is_follow_up = match_count >= 3

    return match_count, is_follow_up


def main():
    """Main hook function."""
    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow to proceed if we can't parse input

    # Extract data
    session_id = input_data.get("session_id", "default")
    user_prompt = input_data.get("user_prompt", "")

    if not user_prompt:
        debug_log("No user prompt found, exiting")
        sys.exit(0)

    debug_log(f"\n{'='*60}")
    debug_log(f"Analyzing user prompt: '{user_prompt}'")
    debug_log(f"Session ID: {session_id}")

    # Step 1: Check if it's a question
    is_question, conditions_met, details = check_question_conditions(user_prompt)

    if not is_question:
        debug_log(f"Not a question ({conditions_met}/4 conditions met), allowing normal processing")
        # Save to history and exit
        history = load_conversation_history(session_id)
        history.append(user_prompt)
        save_conversation_history(session_id, history)
        sys.exit(0)

    debug_log("✓ Detected as a QUESTION")

    # Step 2: Check if it's a follow-up question
    history = load_conversation_history(session_id)
    match_count, is_follow_up = count_matching_words(user_prompt, history)

    # Save current prompt to history
    history.append(user_prompt)
    save_conversation_history(session_id, history)

    # Step 3: Generate optimization suggestion
    if is_follow_up:
        debug_log(f"✓ FOLLOW-UP QUESTION detected ({match_count} matching words)")
        suggestion = f"""
🚀 **Performance Optimization Suggestion**

This appears to be a **follow-up question** related to the recent conversation ({match_count} matching contextual words found).

**Recommendation:** Use a faster model (Haiku) for quick response.

**Question detected:** {user_prompt}

**Conditions met:** {conditions_met}/4
- Starts with question word: {'✓' if details.get('starts_with_question_word') else '✗'}
- Has subject: {'✓' if details.get('has_subject') else '✗'}
- Has verb: {'✓' if details.get('has_verb') else '✗'}
- Ends with '?': {'✓' if details.get('ends_with_question_mark') else '✗'}

💡 **To use faster model:** The system could automatically switch to Haiku for this query.
"""
        print(suggestion, file=sys.stderr)
        debug_log("Displaying follow-up question optimization suggestion")

    else:
        debug_log(f"✓ NEW QUESTION detected ({match_count} matching words - below threshold)")
        suggestion = f"""
📊 **Question Detected**

This is a **new question** (only {match_count} contextual word matches found).

**Question:** {user_prompt}

**Conditions met:** {conditions_met}/4
- Starts with question word: {'✓' if details.get('starts_with_question_word') else '✗'}
- Has subject: {'✓' if details.get('has_subject') else '✗'}
- Has verb: {'✓' if details.get('has_verb') else '✗'}
- Ends with '?': {'✓' if details.get('ends_with_question_mark') else '✗'}

ℹ️  Processing with normal model.
"""
        print(suggestion, file=sys.stderr)
        debug_log("Displaying new question notification")

    # Allow the prompt to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
