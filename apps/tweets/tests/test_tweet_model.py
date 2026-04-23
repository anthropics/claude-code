"""Tweet モデルの単体テスト (P1-07)。

- body 180 字上限 (full_clean で 181 字が ValidationError)
- is_deleted のデフォルト値
- soft_delete メソッド
- TweetManager / all_objects の挙動
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.tweets.models import TWEET_BODY_MAX_LENGTH, Tweet
from apps.tweets.tests._factories import make_tweet, make_user


class TweetBodyLengthTests(TestCase):
    """body の 180 字制約。"""

    def test_body_within_limit_is_valid(self) -> None:
        body = "a" * TWEET_BODY_MAX_LENGTH
        tweet = Tweet(author=make_user(), body=body)
        # full_clean が例外を投げないこと
        tweet.full_clean()

    def test_body_over_limit_raises(self) -> None:
        body = "a" * (TWEET_BODY_MAX_LENGTH + 1)
        tweet = Tweet(author=make_user(), body=body)

        with self.assertRaises(ValidationError) as ctx:
            tweet.full_clean()

        self.assertIn("body", ctx.exception.message_dict)


class TweetDefaultsTests(TestCase):
    """モデルのデフォルト値。"""

    def test_is_deleted_defaults_to_false(self) -> None:
        tweet = make_tweet()
        self.assertFalse(tweet.is_deleted)
        self.assertIsNone(tweet.deleted_at)

    def test_edit_count_defaults_to_zero(self) -> None:
        tweet = make_tweet()
        self.assertEqual(tweet.edit_count, 0)
        self.assertIsNone(tweet.last_edited_at)


class TweetSoftDeleteTests(TestCase):
    """soft_delete の挙動。"""

    def test_soft_delete_sets_flags(self) -> None:
        tweet = make_tweet()

        tweet.soft_delete()
        tweet.refresh_from_db()

        self.assertTrue(tweet.is_deleted)
        self.assertIsNotNone(tweet.deleted_at)

    def test_default_manager_excludes_soft_deleted(self) -> None:
        tweet = make_tweet()
        tweet.soft_delete()

        self.assertFalse(Tweet.objects.filter(pk=tweet.pk).exists())
        # all_objects には残っている
        self.assertTrue(Tweet.all_objects.filter(pk=tweet.pk).exists())

    def test_all_with_deleted_includes_soft_deleted(self) -> None:
        t1 = make_tweet(body="alive")
        t2 = make_tweet(author=t1.author, body="dead")
        t2.soft_delete()

        all_pks = set(Tweet.objects.all_with_deleted().values_list("pk", flat=True))
        self.assertEqual(all_pks, {t1.pk, t2.pk})
