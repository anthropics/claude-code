"""
AI Services - OpenAI API integration
"""
import json
import logging
from typing import Optional, List, Dict, Any
from django.conf import settings
from openai import OpenAI

from .prompts import (
    VoiceContext,
    build_voice_block,
    CLIP_DETECTION_PROMPT,
    VOICE_ANALYSIS_PROMPT,
    YOUTUBE_SHORT_PROMPT,
    TIKTOK_PROMPT,
    X_THREAD_PROMPT,
    X_SINGLE_PROMPT,
    NEWSLETTER_SECTION_PROMPT,
    SHOW_NOTES_PROMPT,
    CONTENT_PLAN_PROMPT,
    build_regen_prompt,
)

logger = logging.getLogger(__name__)


class AIService:
    """
    Service for AI content generation using OpenAI API.
    Handles all LLM interactions with proper error handling.
    """

    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not configured")
        self.client = OpenAI(api_key=api_key)
        self.model = settings.OPENAI_MODEL_CHAT
        self.whisper_model = settings.OPENAI_MODEL_WHISPER

    def _call_llm(
        self,
        prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        """Make a call to the LLM with error handling."""
        try:
            kwargs = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}

            response = self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise

    def _parse_json_response(self, response: str) -> Any:
        """Parse JSON from LLM response, handling common issues."""
        # Try direct parse first
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code blocks
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end > start:
                try:
                    return json.loads(response[start:end].strip())
                except json.JSONDecodeError:
                    pass

        # Try to find array or object
        for char, end_char in [("[", "]"), ("{", "}")]:
            start = response.find(char)
            if start != -1:
                end = response.rfind(end_char)
                if end > start:
                    try:
                        return json.loads(response[start:end + 1])
                    except json.JSONDecodeError:
                        pass

        raise ValueError(f"Could not parse JSON from response: {response[:200]}...")

    # =========================================================================
    # TRANSCRIPTION
    # =========================================================================

    def transcribe_audio(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Transcribe audio file using Whisper API.
        Returns: {text: str, segments: [{start, end, text}], duration: float}
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=self.whisper_model,
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )

            return {
                "text": response.text,
                "segments": [
                    {
                        "start": seg.start,
                        "end": seg.end,
                        "text": seg.text,
                    }
                    for seg in (response.segments or [])
                ],
                "duration": response.duration,
                "language": response.language,
            }

        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    # =========================================================================
    # CLIP DETECTION
    # =========================================================================

    def detect_clips(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Analyze transcript and identify best clips for short-form content.
        Returns list of clip objects with scoring.
        """
        prompt = CLIP_DETECTION_PROMPT.format(transcript=transcript[:15000])
        response = self._call_llm(prompt, max_tokens=3000, temperature=0.3)
        clips = self._parse_json_response(response)

        # Validate and clean clips
        validated = []
        for clip in clips:
            if all(k in clip for k in ["start", "end", "text", "viral_score"]):
                validated.append({
                    "start": float(clip["start"]),
                    "end": float(clip["end"]),
                    "text": str(clip["text"]),
                    "hook_score": int(clip.get("hook_score", 50)),
                    "viral_score": int(clip.get("viral_score", 50)),
                    "tags": clip.get("tags", []),
                    "caption": clip.get("caption", ""),
                })

        return sorted(validated, key=lambda x: x["viral_score"], reverse=True)

    # =========================================================================
    # VOICE ANALYSIS
    # =========================================================================

    def analyze_voice(self, content_samples: List[str]) -> Dict[str, Any]:
        """
        Analyze content samples to extract voice characteristics.
        """
        combined = "\n\n---\n\n".join(content_samples[:5])  # Limit to 5 samples
        prompt = VOICE_ANALYSIS_PROMPT.format(content=combined[:10000])
        response = self._call_llm(prompt, max_tokens=1500, temperature=0.3)
        return self._parse_json_response(response)

    # =========================================================================
    # CONTENT GENERATION
    # =========================================================================

    def generate_youtube_short(
        self,
        topic: str,
        angle: str,
        content_source: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Generate a YouTube Short script."""
        prompt = YOUTUBE_SHORT_PROMPT.format(
            voice_block=build_voice_block(voice),
            content_source=content_source[:3000] if content_source else "No source provided",
            topic=topic,
            angle=angle or "educational",
        )
        return self._call_llm(prompt, max_tokens=500, temperature=0.7)

    def generate_tiktok(
        self,
        topic: str,
        angle: str,
        content_source: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Generate a TikTok script."""
        prompt = TIKTOK_PROMPT.format(
            voice_block=build_voice_block(voice),
            content_source=content_source[:3000] if content_source else "No source provided",
            topic=topic,
            angle=angle or "engaging",
        )
        return self._call_llm(prompt, max_tokens=500, temperature=0.7)

    def generate_x_thread(
        self,
        topic: str,
        angle: str,
        content_source: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Generate an X/Twitter thread."""
        prompt = X_THREAD_PROMPT.format(
            voice_block=build_voice_block(voice),
            content_source=content_source[:3000] if content_source else "No source provided",
            topic=topic,
            angle=angle or "insightful",
        )
        return self._call_llm(prompt, max_tokens=1500, temperature=0.7)

    def generate_x_single(
        self,
        topic: str,
        angle: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Generate a single X/Twitter post."""
        prompt = X_SINGLE_PROMPT.format(
            voice_block=build_voice_block(voice),
            topic=topic,
            angle=angle or "thought-provoking",
        )
        return self._call_llm(prompt, max_tokens=150, temperature=0.8)

    def generate_newsletter_section(
        self,
        topic: str,
        angle: str,
        content_source: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Generate a newsletter section."""
        prompt = NEWSLETTER_SECTION_PROMPT.format(
            voice_block=build_voice_block(voice),
            content_source=content_source[:5000] if content_source else "No source provided",
            topic=topic,
            angle=angle or "valuable",
        )
        return self._call_llm(prompt, max_tokens=800, temperature=0.7)

    def generate_show_notes(
        self,
        title: str,
        duration: str,
        transcript: str,
    ) -> str:
        """Generate podcast show notes."""
        prompt = SHOW_NOTES_PROMPT.format(
            title=title,
            duration=duration,
            transcript=transcript[:12000],
        )
        return self._call_llm(prompt, max_tokens=1500, temperature=0.5)

    # =========================================================================
    # CONTENT PLANNING
    # =========================================================================

    def generate_content_plan(
        self,
        brand_name: str,
        niche: str,
        target_audience: str,
        primary_goal: str,
        platforms: List[str],
        posts_per_day: int,
        recent_topics: List[str],
    ) -> List[Dict[str, Any]]:
        """Generate a week's content plan."""
        prompt = CONTENT_PLAN_PROMPT.format(
            brand_name=brand_name,
            niche=niche or "general",
            target_audience=target_audience or "general audience",
            primary_goal=primary_goal,
            platforms=", ".join(platforms),
            posts_per_day=posts_per_day,
            recent_topics=", ".join(recent_topics[-10:]) if recent_topics else "None",
        )
        response = self._call_llm(prompt, max_tokens=2000, temperature=0.7)
        return self._parse_json_response(response)

    # =========================================================================
    # REGENERATION
    # =========================================================================

    def regenerate_with_feedback(
        self,
        platform: str,
        original_output: str,
        feedback: str,
        topic: str,
        angle: str,
        content_source: str,
        voice: Optional[VoiceContext] = None,
    ) -> str:
        """Regenerate content with user feedback."""
        # Get the original prompt template
        prompt_map = {
            "youtube_short": YOUTUBE_SHORT_PROMPT,
            "tiktok": TIKTOK_PROMPT,
            "x": X_THREAD_PROMPT,
            "x_single": X_SINGLE_PROMPT,
            "newsletter": NEWSLETTER_SECTION_PROMPT,
        }

        template = prompt_map.get(platform, YOUTUBE_SHORT_PROMPT)
        original_prompt = template.format(
            voice_block=build_voice_block(voice),
            content_source=content_source[:3000] if content_source else "",
            topic=topic,
            angle=angle or "",
        )

        regen_prompt = build_regen_prompt(original_prompt, original_output, feedback)
        return self._call_llm(regen_prompt, max_tokens=1500, temperature=0.7)


# Singleton instance
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get or create AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
