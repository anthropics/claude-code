"""
AI Prompts - The Core Product
Platform-specific prompt templates with voice injection.
"""
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class VoiceContext:
    """Voice fingerprint data for prompt injection."""
    sample_phrases: List[str]
    vocabulary_level: str
    humor_style: str
    opening_patterns: List[str]
    closing_patterns: List[str]
    banned_phrases: List[str]
    example_outputs: List[str]


def build_voice_block(voice: Optional[VoiceContext]) -> str:
    """Convert voice fingerprint to prompt instructions."""
    if not voice:
        return "Write in a clear, conversational tone."

    parts = []

    if voice.sample_phrases:
        parts.append(f"Use phrases like: {', '.join(voice.sample_phrases[:5])}")

    if voice.vocabulary_level == "simple":
        parts.append("Use simple, everyday language. No jargon.")
    elif voice.vocabulary_level == "technical":
        parts.append("You can use industry terminology. The audience is knowledgeable.")
    else:
        parts.append("Use conversational language. Explain technical terms briefly if needed.")

    if voice.humor_style:
        parts.append(f"Humor style: {voice.humor_style}")

    if voice.banned_phrases:
        parts.append(f"NEVER use these phrases: {', '.join(voice.banned_phrases[:5])}")

    if voice.opening_patterns:
        parts.append(f"Open content like: {voice.opening_patterns[0]}")

    if voice.closing_patterns:
        parts.append(f"Close content like: {voice.closing_patterns[0]}")

    if voice.example_outputs:
        parts.append("\nExamples of content in this voice:")
        for i, ex in enumerate(voice.example_outputs[:2], 1):
            # Truncate long examples
            example_text = ex[:300] + "..." if len(ex) > 300 else ex
            parts.append(f"{i}. {example_text}")

    return "\n".join(parts)


# =============================================================================
# CLIP DETECTION PROMPT
# =============================================================================

CLIP_DETECTION_PROMPT = """Analyze this transcript and identify the best moments for short-form video clips.

TRANSCRIPT:
{transcript}

For each potential clip, identify:
1. Start timestamp (seconds)
2. End timestamp (seconds) - clips should be 15-60 seconds
3. The exact text
4. Hook score (0-100): How strong is the opening line?
5. Viral score (0-100): Overall potential for engagement
6. Topic tags (2-3 keywords)
7. Suggested caption for social media

WHAT MAKES A GOOD CLIP:
- Strong opening (question, bold statement, surprising fact)
- Self-contained (makes sense without context)
- Emotional (funny, inspiring, controversial, educational)
- Clear point (one idea, well articulated)
- Good pacing (not too slow, not rushing)

BAD CLIPS TO AVOID:
- Rambling or unfocused
- Inside jokes requiring context
- Technical explanations without setup
- Weak/generic openings ("So basically...", "Um, yeah...")

Return as JSON array (find top 5 clips, sorted by viral_score descending):
[
  {{
    "start": 45.2,
    "end": 78.5,
    "text": "exact transcript text here",
    "hook_score": 85,
    "viral_score": 72,
    "tags": ["productivity", "habits"],
    "caption": "suggested social media caption"
  }}
]

Only return the JSON array, no other text."""


# =============================================================================
# VOICE ANALYSIS PROMPT
# =============================================================================

VOICE_ANALYSIS_PROMPT = """Analyze this content sample to extract the creator's unique voice characteristics.

CONTENT SAMPLE:
{content}

Extract the following (return as JSON):

{{
  "sample_phrases": ["list of 5-10 distinctive phrases or expressions they use"],
  "vocabulary_level": "simple|conversational|technical",
  "humor_style": "description of humor style if present, or empty string",
  "opening_patterns": ["how they typically start content - 2-3 patterns"],
  "closing_patterns": ["how they typically end content - 2-3 patterns"],
  "notable_characteristics": ["any other distinctive voice traits"],
  "topics_covered": ["main topics/themes in this sample"]
}}

Focus on:
- Unique expressions and catchphrases
- How they explain complex ideas
- Their energy level (high energy, calm, intense)
- Sentence structure patterns (short punchy vs long flowing)
- How they connect with the audience

Only return the JSON object, no other text."""


# =============================================================================
# YOUTUBE SHORT / TIKTOK SCRIPT PROMPT
# =============================================================================

YOUTUBE_SHORT_PROMPT = """You are writing a YouTube Short script (under 60 seconds when spoken aloud).

VOICE REQUIREMENTS:
{voice_block}

CONTENT SOURCE:
{content_source}

TOPIC:
{topic}

ANGLE/HOOK:
{angle}

PLATFORM RULES FOR YOUTUBE SHORTS:
- First 0.5 seconds must hook. No "Hey guys" or "Welcome back"
- Open with: a bold claim, a question, or mid-action
- One clear point only. No rambling.
- 150-200 words max (60 seconds spoken)
- End with a soft CTA or thought-provoking closer
- Write for SPOKEN delivery, not reading
- Use natural pauses and emphasis markers

SCRIPT FORMAT:
[HOOK - 1-2 lines, punchy, stops the scroll]

[CONTENT - 4-6 lines, the main value]

[CLOSE - 1-2 lines, CTA or callback to hook]

Generate the script now. Only output the script, no explanations."""


TIKTOK_PROMPT = """You are writing a TikTok script (15-60 seconds when spoken).

VOICE REQUIREMENTS:
{voice_block}

CONTENT SOURCE:
{content_source}

TOPIC:
{topic}

ANGLE/HOOK:
{angle}

PLATFORM RULES FOR TIKTOK:
- First frame/second is everything. Start mid-thought or with a pattern interrupt
- Speak directly to camera, conversational
- Trending formats: "POV:", "Things that...", "The truth about...", numbered lists
- 100-180 words (varies by pacing)
- Native TikTok energy - slightly faster, more dynamic
- End with engagement driver (question, challenge, or "follow for part 2")

SCRIPT FORMAT:
[HOOK - pattern interrupt or bold opening]

[CONTENT - the value, quick pacing]

[CLOSE - engagement driver]

Generate the script now. Only output the script, no explanations."""


# =============================================================================
# X/TWITTER PROMPTS
# =============================================================================

X_THREAD_PROMPT = """You are writing a Twitter/X thread (5-8 tweets).

VOICE REQUIREMENTS:
{voice_block}

CONTENT SOURCE:
{content_source}

TOPIC:
{topic}

ANGLE/HOOK:
{angle}

PLATFORM RULES FOR X THREADS:
- Tweet 1 must be a BANGER. Controversial, bold, or extremely useful.
- Each tweet is standalone but flows into the next
- 280 chars per tweet, but aim for 200-250 for readability
- Use line breaks within tweets for scannability
- No hashtags. They look amateur.
- No emojis unless the creator specifically uses them
- End with engagement driver (question, "RT if you agree", or teaser)

FORMAT:
TWEET 1/X:
[The hook tweet - this determines if anyone reads the rest]

TWEET 2/X:
[Context or the "why this matters"]

TWEET 3-6/X:
[The main points, one per tweet]

TWEET 7/X:
[Summary or actionable takeaway]

TWEET 8/X:
[Engagement CTA]

Generate the thread now. Only output the tweets, no explanations."""


X_SINGLE_PROMPT = """You are writing a single Twitter/X post (not a thread).

VOICE REQUIREMENTS:
{voice_block}

TOPIC:
{topic}

ANGLE/HOOK:
{angle}

PLATFORM RULES FOR X SINGLE POSTS:
- 280 character limit, but 180-250 is the sweet spot
- Must be complete and valuable on its own
- Hot takes, insights, or questions perform best
- No hashtags
- Line breaks improve readability

Generate the tweet now. Only output the tweet text, no explanations."""


# =============================================================================
# NEWSLETTER PROMPT
# =============================================================================

NEWSLETTER_SECTION_PROMPT = """You are writing a newsletter section (200-400 words).

VOICE REQUIREMENTS:
{voice_block}

CONTENT SOURCE:
{content_source}

TOPIC:
{topic}

ANGLE/HOOK:
{angle}

PLATFORM RULES FOR NEWSLETTERS:
- Open with a story, anecdote, or surprising fact (not "In this issue...")
- One key insight or lesson
- Practical takeaway the reader can use TODAY
- Write like an email to a smart friend, not a blog post
- Subheadings help scannability
- End with a question, teaser, or clear next step

STRUCTURE:
[Opening hook - story or surprising statement]

[The insight - what you want them to understand]

[The application - how they can use this]

[Close - question or transition]

Generate the section now. Only output the content, no explanations."""


# =============================================================================
# PODCAST SHOW NOTES PROMPT
# =============================================================================

SHOW_NOTES_PROMPT = """You are writing podcast show notes for SEO and listener reference.

EPISODE INFO:
Title: {title}
Duration: {duration}

TRANSCRIPT:
{transcript}

GENERATE THE FOLLOWING SECTIONS:

## Summary
[One paragraph: what's this episode about, who's it for, why listen - 2-3 sentences]

## Key Topics
[Bullet list of 5-8 main topics covered]

## Timestamps
[Major sections with timestamps in format "00:00 - Topic"]

## Notable Quotes
[2-3 quotable moments from the episode, with attribution if multiple speakers]

## Resources Mentioned
[Any tools, books, links mentioned - note if none were mentioned]

## Key Takeaways
[3 actionable points listeners should remember]

Generate the show notes now. Use markdown formatting."""


# =============================================================================
# BULK GENERATION PROMPT
# =============================================================================

CONTENT_PLAN_PROMPT = """You are a content strategist creating a week's content plan.

BRAND INFO:
Name: {brand_name}
Niche: {niche}
Target Audience: {target_audience}
Primary Goal: {primary_goal}

PLATFORMS TO PLAN FOR:
{platforms}

POSTS PER DAY:
{posts_per_day}

RECENT CONTENT (for variety):
{recent_topics}

Create a 7-day content plan. For each post, provide:
1. Day (Monday-Sunday)
2. Platform
3. Topic (specific, not generic)
4. Angle/Hook (what makes this unique)
5. Intent (educate/entertain/inspire/convert)

RULES:
- Vary topics across the week - no repetition
- Each platform should feel native (not cross-posted content)
- Include a mix of intents
- If goal is "monetize", include 1-2 conversion-focused posts
- If goal is "growth", focus on shareable/saveable content
- If goal is "authority", lean into educational deep-dives

Return as JSON array:
[
  {{
    "day": "Monday",
    "day_of_week": 0,
    "platform": "youtube_short",
    "topic": "specific topic here",
    "angle": "the unique hook or angle",
    "intent": "educate"
  }}
]

Generate the plan now. Only output the JSON array."""


# =============================================================================
# REGENERATION PROMPT WRAPPER
# =============================================================================

def build_regen_prompt(original_prompt: str, original_output: str, feedback: str) -> str:
    """Wrap a prompt for regeneration with user feedback."""
    return f"""{original_prompt}

---

PREVIOUS OUTPUT (user wants changes):
{original_output}

USER FEEDBACK:
{feedback}

Generate an improved version addressing the feedback. Only output the new content, no explanations."""
