"""
Celery Tasks - Async AI operations
"""
import logging
import tempfile
import requests
from typing import List, Optional
from celery import shared_task
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def transcribe_audio_task(self, job_id: str, audio_url: str):
    """
    Transcribe audio from URL using Whisper API.
    Creates Transcript record with segments.
    """
    from apps.core.models import GenerationJob
    from apps.content.models import Transcript
    from apps.ai.services import get_ai_service

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        # Download audio to temp file
        job.update_progress(10)
        response = requests.get(audio_url, timeout=120)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # Transcribe
        job.update_progress(30)
        ai = get_ai_service()
        result = ai.transcribe_audio(tmp_path)

        job.update_progress(80)

        # Update transcript record
        transcript_id = job.input_data.get("transcript_id")
        if transcript_id:
            transcript = Transcript.objects.get(id=transcript_id)
            transcript.raw_text = result["text"]
            transcript.segments_json = result["segments"]
            transcript.duration_seconds = int(result.get("duration", 0))
            transcript.language = result.get("language", "en")
            transcript.status = "ready"
            transcript.save()

        job.mark_completed(result={
            "transcript_id": transcript_id,
            "duration_seconds": result.get("duration"),
            "word_count": len(result["text"].split()),
        })

        return {"status": "success", "transcript_id": transcript_id}

    except Exception as e:
        logger.exception(f"Transcription failed for job {job_id}")
        job.mark_failed(str(e))

        # Update transcript status
        transcript_id = job.input_data.get("transcript_id")
        if transcript_id:
            Transcript.objects.filter(id=transcript_id).update(
                status="failed",
                error_message=str(e)[:500]
            )

        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def detect_clips_task(self, job_id: str, transcript_id: str):
    """
    Analyze transcript and detect viral clips.
    Creates Clip records for each detected moment.
    """
    from apps.core.models import GenerationJob
    from apps.content.models import Transcript, Clip
    from apps.ai.services import get_ai_service

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        transcript = Transcript.objects.get(id=transcript_id)

        if not transcript.raw_text:
            raise ValueError("Transcript has no text content")

        job.update_progress(20)
        ai = get_ai_service()
        clips_data = ai.detect_clips(transcript.raw_text)

        job.update_progress(70)

        # Create clip records
        clips_created = []
        with transaction.atomic():
            for clip_data in clips_data:
                clip = Clip.objects.create(
                    transcript=transcript,
                    start_time=clip_data["start"],
                    end_time=clip_data["end"],
                    text=clip_data["text"],
                    hook_score=clip_data["hook_score"],
                    viral_score=clip_data["viral_score"],
                    topic_tags=clip_data["tags"],
                    suggested_caption=clip_data["caption"],
                    status="detected",
                )
                clips_created.append(str(clip.id))

        job.mark_completed(result={
            "transcript_id": transcript_id,
            "clips_created": len(clips_created),
            "clip_ids": clips_created,
        })

        return {"status": "success", "clips_created": len(clips_created)}

    except Exception as e:
        logger.exception(f"Clip detection failed for job {job_id}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def learn_voice_task(self, job_id: str, brand_id: str):
    """
    Analyze brand's content samples and update voice fingerprint.
    """
    from apps.core.models import GenerationJob
    from apps.content.models import Brand, SourceSample, VoiceFingerprint
    from apps.ai.services import get_ai_service

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        brand = Brand.objects.get(id=brand_id)
        samples = SourceSample.objects.filter(brand=brand, analyzed=False)[:5]

        if not samples:
            job.mark_completed(result={"message": "No new samples to analyze"})
            return {"status": "no_samples"}

        job.update_progress(20)
        ai = get_ai_service()

        # Combine sample texts
        sample_texts = [s.raw_text for s in samples]
        voice_data = ai.analyze_voice(sample_texts)

        job.update_progress(70)

        # Update or create voice fingerprint
        voice, created = VoiceFingerprint.objects.get_or_create(brand=brand)

        # Merge new data with existing
        if voice.sample_phrases:
            existing = set(voice.sample_phrases)
            new_phrases = voice_data.get("sample_phrases", [])
            voice.sample_phrases = list(existing | set(new_phrases))[:20]
        else:
            voice.sample_phrases = voice_data.get("sample_phrases", [])[:20]

        voice.vocabulary_level = voice_data.get("vocabulary_level", voice.vocabulary_level)
        voice.humor_style = voice_data.get("humor_style", voice.humor_style)

        if voice_data.get("opening_patterns"):
            voice.opening_patterns = (voice.opening_patterns + voice_data["opening_patterns"])[:10]
        if voice_data.get("closing_patterns"):
            voice.closing_patterns = (voice.closing_patterns + voice_data["closing_patterns"])[:10]

        voice.samples_analyzed += len(samples)
        voice.last_learned_at = timezone.now()
        voice.save()

        # Mark samples as analyzed
        samples.update(analyzed=True)

        job.mark_completed(result={
            "samples_analyzed": len(samples),
            "voice_updated": True,
        })

        return {"status": "success", "samples_analyzed": len(samples)}

    except Exception as e:
        logger.exception(f"Voice learning failed for job {job_id}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_draft_task(
    self,
    job_id: str,
    plan_item_id: str,
    platform: str,
):
    """
    Generate content draft for a plan item.
    """
    from apps.core.models import GenerationJob
    from apps.content.models import PlanItem, Draft, DraftVersion, VoiceFingerprint
    from apps.ai.services import get_ai_service, VoiceContext

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        plan_item = PlanItem.objects.select_related(
            "content_plan__brand",
            "source_clip__transcript",
            "source_transcript",
        ).get(id=plan_item_id)

        brand = plan_item.content_plan.brand

        job.update_progress(20)

        # Get voice context
        voice_ctx = None
        try:
            voice = VoiceFingerprint.objects.get(brand=brand)
            voice_ctx = VoiceContext(**voice.to_prompt_context())
        except VoiceFingerprint.DoesNotExist:
            pass

        # Get content source
        content_source = ""
        if plan_item.source_clip:
            content_source = plan_item.source_clip.text
        elif plan_item.source_transcript:
            content_source = plan_item.source_transcript.raw_text[:5000]

        job.update_progress(40)

        # Generate content
        ai = get_ai_service()
        platform_map = {
            "youtube_short": ai.generate_youtube_short,
            "tiktok": ai.generate_tiktok,
            "x": ai.generate_x_thread,
            "x_single": ai.generate_x_single,
            "newsletter": ai.generate_newsletter_section,
            "instagram_reel": ai.generate_tiktok,  # Similar format
        }

        generator = platform_map.get(platform, ai.generate_youtube_short)
        content = generator(
            topic=plan_item.topic,
            angle=plan_item.angle,
            content_source=content_source,
            voice=voice_ctx,
        )

        job.update_progress(80)

        # Create draft and version
        with transaction.atomic():
            draft = Draft.objects.create(
                plan_item=plan_item,
                platform=platform,
                current_version=1,
                status="ready_for_review",
            )

            DraftVersion.objects.create(
                draft=draft,
                version=1,
                content=content,
                metadata={
                    "topic": plan_item.topic,
                    "angle": plan_item.angle,
                    "has_voice": voice_ctx is not None,
                },
                created_by="ai",
            )

            plan_item.status = "ready"
            plan_item.save(update_fields=["status", "updated_at"])

        job.mark_completed(result={
            "draft_id": str(draft.id),
            "platform": platform,
            "word_count": len(content.split()),
        })

        return {"status": "success", "draft_id": str(draft.id)}

    except Exception as e:
        logger.exception(f"Draft generation failed for job {job_id}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def regenerate_draft_task(self, job_id: str, draft_id: str, feedback: str):
    """
    Regenerate a draft with user feedback.
    """
    from apps.core.models import GenerationJob
    from apps.content.models import Draft, DraftVersion, VoiceFingerprint
    from apps.ai.services import get_ai_service, VoiceContext

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        draft = Draft.objects.select_related(
            "plan_item__content_plan__brand",
            "plan_item__source_clip",
            "plan_item__source_transcript",
        ).get(id=draft_id)

        plan_item = draft.plan_item
        brand = plan_item.content_plan.brand

        # Get current version content
        current_version = DraftVersion.objects.filter(
            draft=draft
        ).order_by("-version").first()

        if not current_version:
            raise ValueError("No existing version to regenerate from")

        job.update_progress(20)

        # Get voice context
        voice_ctx = None
        try:
            voice = VoiceFingerprint.objects.get(brand=brand)
            voice_ctx = VoiceContext(**voice.to_prompt_context())
        except VoiceFingerprint.DoesNotExist:
            pass

        # Get content source
        content_source = ""
        if plan_item.source_clip:
            content_source = plan_item.source_clip.text
        elif plan_item.source_transcript:
            content_source = plan_item.source_transcript.raw_text[:5000]

        job.update_progress(40)

        # Regenerate
        ai = get_ai_service()
        new_content = ai.regenerate_with_feedback(
            platform=draft.platform,
            original_output=current_version.content,
            feedback=feedback,
            topic=plan_item.topic,
            angle=plan_item.angle,
            content_source=content_source,
            voice=voice_ctx,
        )

        job.update_progress(80)

        # Create new version
        new_version_num = current_version.version + 1
        with transaction.atomic():
            new_version = DraftVersion.objects.create(
                draft=draft,
                version=new_version_num,
                content=new_content,
                metadata={"regenerated_from": current_version.version},
                created_by="ai",
                regen_feedback=feedback,
            )

            draft.current_version = new_version_num
            draft.status = "ready_for_review"
            draft.save(update_fields=["current_version", "status", "updated_at"])

        job.mark_completed(result={
            "draft_id": str(draft.id),
            "new_version": new_version_num,
            "word_count": len(new_content.split()),
        })

        return {"status": "success", "new_version": new_version_num}

    except Exception as e:
        logger.exception(f"Draft regeneration failed for job {job_id}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_content_plan_task(
    self,
    job_id: str,
    brand_id: str,
    week_start: str,
    platforms: List[str],
    posts_per_day: int,
):
    """
    Generate a week's content plan.
    """
    from datetime import datetime
    from apps.core.models import GenerationJob
    from apps.content.models import Brand, ContentPlan, PlanItem
    from apps.ai.services import get_ai_service

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        brand = Brand.objects.get(id=brand_id)
        week_start_date = datetime.strptime(week_start, "%Y-%m-%d").date()

        job.update_progress(20)

        # Get recent topics to avoid repetition
        recent_items = PlanItem.objects.filter(
            content_plan__brand=brand
        ).order_by("-created_at")[:20]
        recent_topics = [item.topic for item in recent_items]

        job.update_progress(40)

        ai = get_ai_service()
        plan_data = ai.generate_content_plan(
            brand_name=brand.name,
            niche=brand.niche,
            target_audience=brand.target_audience,
            primary_goal=brand.primary_goal,
            platforms=platforms,
            posts_per_day=posts_per_day,
            recent_topics=recent_topics,
        )

        job.update_progress(70)

        # Create plan and items
        with transaction.atomic():
            plan, _ = ContentPlan.objects.get_or_create(
                brand=brand,
                week_start=week_start_date,
                defaults={"status": "draft", "plan_metadata": {"platforms": platforms}},
            )

            # Clear existing items if regenerating
            PlanItem.objects.filter(content_plan=plan).delete()

            items_created = []
            for item_data in plan_data:
                item = PlanItem.objects.create(
                    content_plan=plan,
                    day_of_week=item_data.get("day_of_week", 0),
                    platform=item_data["platform"],
                    topic=item_data["topic"],
                    angle=item_data.get("angle", ""),
                    intent=item_data.get("intent", "educate"),
                    status="planned",
                )
                items_created.append(str(item.id))

        job.mark_completed(result={
            "plan_id": str(plan.id),
            "items_created": len(items_created),
        })

        return {"status": "success", "plan_id": str(plan.id)}

    except Exception as e:
        logger.exception(f"Content plan generation failed for job {job_id}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)
