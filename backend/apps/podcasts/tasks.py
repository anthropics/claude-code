"""
Podcast Celery Tasks
"""
import logging
import requests
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def publish_episode_task(
    self,
    job_id: str,
    episode_id: str,
    host: str,
    publish_at: str = None
):
    """
    Publish episode to podcast host (RSS.com, etc.)
    """
    from apps.core.models import GenerationJob
    from apps.podcasts.models import Episode, PodcastHostConnection
    from apps.publishing.models import Publish

    job = GenerationJob.objects.get(id=job_id)
    job.mark_running()

    try:
        episode = Episode.objects.select_related(
            "show__brand__workspace"
        ).get(id=episode_id)

        connection = PodcastHostConnection.objects.get(
            show=episode.show,
            host=host
        )

        # Create publish audit record
        pub = Publish.objects.create(
            workspace=episode.show.brand.workspace,
            platform=host,
            content_type="podcast_episode",
            source_id=episode.id,
            payload={
                "title": episode.title,
                "description": episode.description,
            },
            scheduled_for=publish_at,
            status="running",
        )

        job.update_progress(30)

        if host == "rss_com":
            result = _publish_to_rsscom(episode, connection, publish_at)
        else:
            raise ValueError(f"Unsupported host: {host}")

        job.update_progress(90)

        # Update records
        pub.mark_published(
            platform_post_id=result.get("episode_id", ""),
            platform_url=result.get("url", ""),
        )

        episode.status = "published"
        episode.published_at = timezone.now()
        episode.external_id = result.get("episode_id", "")
        episode.external_url = result.get("url", "")
        episode.save(update_fields=[
            "status", "published_at", "external_id", "external_url", "updated_at"
        ])

        job.mark_completed(result=result)
        return {"status": "published", **result}

    except Exception as e:
        logger.exception(f"Episode publish failed: {e}")
        job.mark_failed(str(e))
        raise self.retry(exc=e)


def _publish_to_rsscom(episode, connection, publish_at=None):
    """
    Publish to RSS.com using their API.
    """
    from django.conf import settings

    api_key = connection.api_key
    if not api_key:
        raise ValueError("RSS.com API key not configured")

    external_show_id = connection.external_show_id
    if not external_show_id:
        raise ValueError("External show ID not configured")

    base_url = settings.RSSCOM_BASE_URL.rstrip("/")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # If we have audio, we'd upload it first
    # For MVP, we assume audio_url is already a public URL

    # Create episode
    payload = {
        "podcast_id": external_show_id,
        "title": episode.title,
        "description": episode.description or episode.title,
    }

    if episode.audio_url:
        payload["audio_url"] = episode.audio_url

    if publish_at:
        payload["publish_at"] = publish_at

    response = requests.post(
        f"{base_url}{settings.RSSCOM_EPISODES_PATH}",
        json=payload,
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()

    data = response.json()
    return {
        "episode_id": data.get("id", ""),
        "url": data.get("url", ""),
        "raw_response": data,
    }
