"""TweetImage のテスト (P1-07)。

- 4 枚まで OK、5 枚目は clean() / save() で ValidationError
- (tweet, order) ユニーク制約
- save() が full_clean を呼ぶ (ORM 直 create bypass 防止 / python-reviewer HIGH)
- MaxValueValidator(order <= 3)
- URLField (https 限定 / security-reviewer HIGH)
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.tweets.models import TWEET_MAX_IMAGES, TweetImage
from apps.tweets.tests._factories import make_tweet


def _make_image(tweet, order: int) -> TweetImage:
    return TweetImage.objects.create(
        tweet=tweet,
        image_url=f"https://example.com/img-{order}.png",
        width=800,
        height=600,
        order=order,
    )


class TweetImageLimitTests(TestCase):
    """添付枚数の上限 (4)。"""

    def test_up_to_four_images_allowed(self) -> None:
        tweet = make_tweet()
        for i in range(TWEET_MAX_IMAGES):
            _make_image(tweet, i)

        self.assertEqual(tweet.images.count(), TWEET_MAX_IMAGES)

    def test_fifth_image_raises_validation_error_via_full_clean(self) -> None:
        tweet = make_tweet()
        for i in range(TWEET_MAX_IMAGES):
            _make_image(tweet, i)

        # 5 枚目を full_clean() で弾く
        fifth = TweetImage(
            tweet=tweet,
            image_url="https://example.com/img-4.png",
            width=800,
            height=600,
            order=4,
        )
        with self.assertRaises(ValidationError):
            fifth.full_clean()

    def test_fifth_image_rejected_even_via_objects_create(self) -> None:
        """python-reviewer HIGH: save() で full_clean を強制しているため、
        ORM 直の ``TweetImage.objects.create`` 経由でも 5 枚目は拒否される。
        """

        tweet = make_tweet()
        for i in range(TWEET_MAX_IMAGES):
            _make_image(tweet, i)

        with self.assertRaises(ValidationError):
            TweetImage.objects.create(
                tweet=tweet,
                image_url="https://example.com/img-4.png",
                width=800,
                height=600,
                # order=4 は MaxValueValidator でも拒否される
                order=4,
            )


class TweetImageOrderUniqueTests(TestCase):
    """(tweet, order) のユニーク制約。"""

    def test_order_must_be_unique_per_tweet(self) -> None:
        """save() で full_clean が走るため、(tweet, order) 重複は
        validate_unique により ``ValidationError`` として拒否される。
        """

        tweet = make_tweet()
        _make_image(tweet, 0)

        with self.assertRaises(ValidationError):
            _make_image(tweet, 0)

    def test_same_order_allowed_across_different_tweets(self) -> None:
        t1 = make_tweet()
        t2 = make_tweet(author=t1.author)

        _make_image(t1, 0)
        _make_image(t2, 0)

        self.assertEqual(TweetImage.objects.filter(order=0).count(), 2)

    def test_images_ordered_by_order_field(self) -> None:
        tweet = make_tweet()
        _make_image(tweet, 2)
        _make_image(tweet, 0)
        _make_image(tweet, 1)

        orders = list(tweet.images.values_list("order", flat=True))
        self.assertEqual(orders, [0, 1, 2])


class TweetImageOrderValidatorTests(TestCase):
    """MaxValueValidator(order <= TWEET_MAX_IMAGES - 1)。"""

    def test_order_at_max_is_valid(self) -> None:
        tweet = make_tweet()
        # order=3 は境界内
        img = TweetImage(
            tweet=tweet,
            image_url="https://example.com/img.png",
            width=800,
            height=600,
            order=TWEET_MAX_IMAGES - 1,
        )
        img.full_clean()

    def test_order_above_max_rejected(self) -> None:
        tweet = make_tweet()
        img = TweetImage(
            tweet=tweet,
            image_url="https://example.com/img.png",
            width=800,
            height=600,
            order=TWEET_MAX_IMAGES,  # 4 は MaxValueValidator で拒否
        )
        with self.assertRaises(ValidationError) as ctx:
            img.full_clean()
        self.assertIn("order", ctx.exception.message_dict)


class TweetImageUrlValidationTests(TestCase):
    """security-reviewer HIGH: image_url は https 限定 URL。"""

    def test_https_url_is_valid(self) -> None:
        tweet = make_tweet()
        img = TweetImage(
            tweet=tweet,
            image_url="https://example.com/ok.png",
            width=800,
            height=600,
            order=0,
        )
        img.full_clean()

    def test_http_url_rejected(self) -> None:
        tweet = make_tweet()
        img = TweetImage(
            tweet=tweet,
            image_url="http://example.com/bad.png",
            width=800,
            height=600,
            order=0,
        )
        with self.assertRaises(ValidationError) as ctx:
            img.full_clean()
        self.assertIn("image_url", ctx.exception.message_dict)

    def test_javascript_scheme_rejected(self) -> None:
        tweet = make_tweet()
        img = TweetImage(
            tweet=tweet,
            image_url="javascript:alert(1)",
            width=800,
            height=600,
            order=0,
        )
        with self.assertRaises(ValidationError):
            img.full_clean()
