"""
Billing Views - Subscription management and Stripe integration
"""
import stripe
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils.decorators import method_decorator
from django.utils import timezone

from apps.core.models import Workspace
from apps.core.permissions import IsWorkspaceMember
from .models import Subscription, UsageEvent
from .serializers import (
    SubscriptionSerializer, UsageEventSerializer,
    CreateCheckoutSessionSerializer, CreatePortalSessionSerializer
)

logger = logging.getLogger(__name__)

# Initialize Stripe
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY


class SubscriptionViewSet(viewsets.ReadOnlyModelViewSet):
    """View subscription status."""
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        user_workspaces = Workspace.objects.filter(
            memberships__user=self.request.user
        )
        return Subscription.objects.filter(workspace__in=user_workspaces)

    @action(detail=False, methods=["get"])
    def current(self, request):
        """Get current user's subscription."""
        workspace = Workspace.objects.filter(
            memberships__user=request.user
        ).first()

        if not workspace:
            return Response(
                {"error": "No workspace found"},
                status=status.HTTP_404_NOT_FOUND
            )

        subscription, created = Subscription.objects.get_or_create(
            workspace=workspace,
            defaults={"plan": "free"}
        )

        return Response(SubscriptionSerializer(subscription).data)


class UsageEventViewSet(viewsets.ReadOnlyModelViewSet):
    """View usage history."""
    serializer_class = UsageEventSerializer
    permission_classes = [permissions.IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        user_workspaces = Workspace.objects.filter(
            memberships__user=self.request.user
        )
        return UsageEvent.objects.filter(workspace__in=user_workspaces)


class CreateCheckoutSessionView(APIView):
    """
    POST /api/v1/billing/checkout/
    Create Stripe checkout session for subscription.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {"error": "Stripe not configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        serializer = CreateCheckoutSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Get workspace and subscription
        workspace = Workspace.objects.filter(
            memberships__user=request.user
        ).first()

        if not workspace:
            return Response(
                {"error": "No workspace found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        subscription, _ = Subscription.objects.get_or_create(
            workspace=workspace,
            defaults={"plan": "free"}
        )

        # Get or create Stripe customer
        if not subscription.stripe_customer_id:
            customer = stripe.Customer.create(
                email=request.user.email,
                metadata={"workspace_id": str(workspace.id)},
            )
            subscription.stripe_customer_id = customer.id
            subscription.save(update_fields=["stripe_customer_id"])

        # Get price ID for plan
        price_id = settings.STRIPE_PRICE_IDS.get(data["plan"])
        if not price_id:
            return Response(
                {"error": f"Price not configured for plan: {data['plan']}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create checkout session
        try:
            session = stripe.checkout.Session.create(
                customer=subscription.stripe_customer_id,
                payment_method_types=["card"],
                line_items=[{
                    "price": price_id,
                    "quantity": 1,
                }],
                mode="subscription",
                success_url=data["success_url"],
                cancel_url=data["cancel_url"],
                metadata={
                    "workspace_id": str(workspace.id),
                    "plan": data["plan"],
                },
            )

            return Response({
                "checkout_url": session.url,
                "session_id": session.id,
            })

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class CreatePortalSessionView(APIView):
    """
    POST /api/v1/billing/portal/
    Create Stripe customer portal session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {"error": "Stripe not configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        serializer = CreatePortalSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        workspace = Workspace.objects.filter(
            memberships__user=request.user
        ).first()

        if not workspace:
            return Response(
                {"error": "No workspace found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            subscription = Subscription.objects.get(workspace=workspace)
        except Subscription.DoesNotExist:
            return Response(
                {"error": "No subscription found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not subscription.stripe_customer_id:
            return Response(
                {"error": "No Stripe customer found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            session = stripe.billing_portal.Session.create(
                customer=subscription.stripe_customer_id,
                return_url=data["return_url"],
            )

            return Response({"portal_url": session.url})

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {e}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    POST /api/v1/billing/webhook/
    Handle Stripe webhook events.
    """
    if not settings.STRIPE_SECRET_KEY:
        return HttpResponse(status=503)

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        logger.error("Invalid Stripe webhook payload")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid Stripe webhook signature")
        return HttpResponse(status=400)

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Stripe webhook received: {event_type}")

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(data)
        elif event_type == "customer.subscription.updated":
            _handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(data)
        elif event_type == "invoice.payment_failed":
            _handle_payment_failed(data)
    except Exception as e:
        logger.exception(f"Error handling webhook {event_type}: {e}")
        return HttpResponse(status=500)

    return HttpResponse(status=200)


def _handle_checkout_completed(data):
    """Handle successful checkout."""
    workspace_id = data.get("metadata", {}).get("workspace_id")
    plan = data.get("metadata", {}).get("plan")
    subscription_id = data.get("subscription")

    if not workspace_id:
        logger.error("No workspace_id in checkout metadata")
        return

    try:
        subscription = Subscription.objects.get(workspace_id=workspace_id)
        subscription.plan = plan
        subscription.stripe_subscription_id = subscription_id
        subscription.status = "active"
        subscription.save(update_fields=[
            "plan", "stripe_subscription_id", "status", "updated_at"
        ])
        logger.info(f"Subscription activated: {workspace_id} -> {plan}")
    except Subscription.DoesNotExist:
        logger.error(f"Subscription not found for workspace: {workspace_id}")


def _handle_subscription_updated(data):
    """Handle subscription update."""
    stripe_sub_id = data.get("id")
    status_val = data.get("status")
    cancel_at_period_end = data.get("cancel_at_period_end", False)
    current_period_end = data.get("current_period_end")

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        subscription.status = status_val
        subscription.cancel_at_period_end = cancel_at_period_end

        if current_period_end:
            subscription.current_period_end = timezone.datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            )

        subscription.save(update_fields=[
            "status", "cancel_at_period_end", "current_period_end", "updated_at"
        ])
        logger.info(f"Subscription updated: {stripe_sub_id} -> {status_val}")
    except Subscription.DoesNotExist:
        logger.warning(f"Subscription not found: {stripe_sub_id}")


def _handle_subscription_deleted(data):
    """Handle subscription cancellation."""
    stripe_sub_id = data.get("id")

    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        subscription.plan = "free"
        subscription.status = "canceled"
        subscription.stripe_subscription_id = ""
        subscription.reset_usage()
        subscription.save(update_fields=[
            "plan", "status", "stripe_subscription_id", "updated_at"
        ])
        logger.info(f"Subscription canceled: {stripe_sub_id}")
    except Subscription.DoesNotExist:
        logger.warning(f"Subscription not found for cancellation: {stripe_sub_id}")


def _handle_payment_failed(data):
    """Handle failed payment."""
    customer_id = data.get("customer")

    try:
        subscription = Subscription.objects.get(stripe_customer_id=customer_id)
        subscription.status = "past_due"
        subscription.save(update_fields=["status", "updated_at"])
        logger.info(f"Payment failed for customer: {customer_id}")
    except Subscription.DoesNotExist:
        logger.warning(f"Subscription not found for customer: {customer_id}")
