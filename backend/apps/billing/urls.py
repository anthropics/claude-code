"""
Billing API URLs
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SubscriptionViewSet, UsageEventViewSet,
    CreateCheckoutSessionView, CreatePortalSessionView,
    stripe_webhook
)

router = DefaultRouter()
router.register(r"subscriptions", SubscriptionViewSet, basename="subscription")
router.register(r"usage", UsageEventViewSet, basename="usage")

urlpatterns = [
    path("", include(router.urls)),
    path("billing/checkout/", CreateCheckoutSessionView.as_view(), name="create-checkout"),
    path("billing/portal/", CreatePortalSessionView.as_view(), name="create-portal"),
    path("billing/webhook/", stripe_webhook, name="stripe-webhook"),
]
