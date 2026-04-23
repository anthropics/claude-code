"""TweetTag のテスト (P1-07)。

- 3 個まで OK、4 個目は clean() / save() で ValidationError
- (tweet, tag) のユニーク制約
- save() が full_clean を必ず呼ぶ (ORM 直 create bypass 防止 / python-reviewer HIGH)
- 未承認タグは紐付けできない (security-reviewer HIGH + CROSS-PR)
"""

from __future__ import annotations

from unittest import mock

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.tweets.models import TWEET_MAX_TAGS, TweetTag
from apps.tweets.tests._factories import make_tag, make_tweet


class TweetTagLimitTests(TestCase):
    """1 ツイートあたりのタグ数上限 (3)。"""

    def test_up_to_three_tags_allowed(self) -> None:
        tweet = make_tweet()
        for i in range(TWEET_MAX_TAGS):
            tag = make_tag(name=f"tag{i}")
            TweetTag.objects.create(tweet=tweet, tag=tag)

        self.assertEqual(tweet.tags.count(), TWEET_MAX_TAGS)

    def test_fourth_tag_raises_validation_error_via_full_clean(self) -> None:
        tweet = make_tweet()
        for i in range(TWEET_MAX_TAGS):
            tag = make_tag(name=f"tag{i}")
            TweetTag.objects.create(tweet=tweet, tag=tag)

        fourth_tag = make_tag(name="tag-extra")
        fourth = TweetTag(tweet=tweet, tag=fourth_tag)

        with self.assertRaises(ValidationError):
            fourth.full_clean()

    def test_fourth_tag_rejected_even_via_objects_create(self) -> None:
        """python-reviewer HIGH: save() が full_clean を必ず呼ぶので、
        ``TweetTag.objects.create`` の ORM 直呼びでも 4 個目は拒否される。
        """

        tweet = make_tweet()
        for i in range(TWEET_MAX_TAGS):
            tag = make_tag(name=f"tag{i}")
            TweetTag.objects.create(tweet=tweet, tag=tag)

        fourth_tag = make_tag(name="tag-extra")
        with self.assertRaises(ValidationError):
            TweetTag.objects.create(tweet=tweet, tag=fourth_tag)


class TweetTagUniqueTests(TestCase):
    """(tweet, tag) のユニーク制約。"""

    def test_same_tag_cannot_be_attached_twice(self) -> None:
        """save() で full_clean が走るため、同じ (tweet, tag) の重複は
        ``ValidationError`` (validate_unique) で先に拒否される。
        """

        tweet = make_tweet()
        tag = make_tag(name="python")
        TweetTag.objects.create(tweet=tweet, tag=tag)

        with self.assertRaises(ValidationError):
            TweetTag.objects.create(tweet=tweet, tag=tag)

    def test_same_tag_allowed_on_different_tweets(self) -> None:
        tag = make_tag(name="python")
        t1 = make_tweet()
        t2 = make_tweet(author=t1.author)

        TweetTag.objects.create(tweet=t1, tag=tag)
        TweetTag.objects.create(tweet=t2, tag=tag)

        self.assertEqual(TweetTag.objects.filter(tag=tag).count(), 2)


class TweetTagApprovalTests(TestCase):
    """security-reviewer HIGH: 未承認タグは紐付けできない (CROSS-PR 前提)。"""

    def test_unapproved_tag_is_rejected(self) -> None:
        tweet = make_tweet()
        tag = make_tag(name="banned")

        # tags worktree 側での Tag.is_approved を擬似的に False にする。
        # PropertyMock を使ってインスタンス属性ではなくクラス属性として差し込む。
        with mock.patch.object(
            type(tag), "is_approved", new_callable=mock.PropertyMock, create=True
        ) as mocked:
            mocked.return_value = False
            tt = TweetTag(tweet=tweet, tag=tag)
            with self.assertRaises(ValidationError):
                tt.full_clean()
