"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { subscriptionApi, authApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  CreditCard,
  Zap,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import type { Subscription } from "@/types";
import toast from "react-hot-toast";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    features: [
      "1 hour transcription/month",
      "10 AI generations/month",
      "1 brand voice",
    ],
  },
  {
    id: "creator",
    name: "Creator",
    price: 29,
    features: [
      "10 hours transcription/month",
      "100 AI generations/month",
      "3 brand voices",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    features: [
      "50 hours transcription/month",
      "Unlimited AI generations",
      "10 brand voices",
      "API access",
    ],
  },
];

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user?.full_name || "");

  useEffect(() => {
    fetchSubscription();
  }, []);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const sub = await subscriptionApi.getCurrent();
      setSubscription(sub);
    } catch (error) {
      // No subscription - on free plan
      console.log("No active subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await authApi.updateMe({ full_name: fullName });
      setUser(updated);
      toast.success("Profile updated!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;

    setUpgrading(planId);
    try {
      const currentUrl = window.location.origin;
      const { checkout_url } = await subscriptionApi.createCheckout(
        planId,
        `${currentUrl}/settings?success=true`,
        `${currentUrl}/settings?canceled=true`
      );
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Failed to create checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const currentUrl = window.location.origin;
      const { portal_url } = await subscriptionApi.createPortal(
        `${currentUrl}/settings`
      );
      window.location.href = portal_url;
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      toast.error("Failed to open billing portal");
    }
  };

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Subscription updated! Welcome to your new plan.");
      window.history.replaceState({}, "", "/settings");
      fetchSubscription();
    } else if (params.get("canceled") === "true") {
      toast.error("Checkout canceled.");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const currentPlan = subscription?.plan || "free";
  const usagePercent = subscription
    ? Math.round((subscription.current_usage.generations / subscription.limits.generations_per_month) * 100)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and subscription
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={user?.email || ""} disabled />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Manage your plan and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  {plans.find((p) => p.id === currentPlan)?.name || "Free"} Plan
                </span>
                <Badge variant={currentPlan === "free" ? "secondary" : "default"}>
                  {currentPlan === "free" ? "Free" : "Active"}
                </Badge>
              </div>
              {subscription && (
                <p className="text-sm text-muted-foreground mt-1">
                  Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            {subscription && currentPlan !== "free" && (
              <Button variant="outline" onClick={handleManageBilling}>
                Manage Billing
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Usage */}
          {subscription && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Usage This Month
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>AI Generations</span>
                    <span>
                      {subscription.current_usage.generations} / {subscription.limits.generations_per_month}
                    </span>
                  </div>
                  <Progress value={usagePercent} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Transcription Hours</span>
                    <span>
                      {subscription.current_usage.transcription_minutes} / {subscription.limits.transcription_minutes_per_month} min
                    </span>
                  </div>
                  <Progress
                    value={
                      (subscription.current_usage.transcription_minutes /
                        subscription.limits.transcription_minutes_per_month) *
                      100
                    }
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Brand Voices</span>
                    <span>
                      {subscription.current_usage.brands} / {subscription.limits.brands}
                    </span>
                  </div>
                  <Progress
                    value={(subscription.current_usage.brands / subscription.limits.brands) * 100}
                  />
                </div>
              </div>
              {usagePercent >= 80 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Running low on generations
                    </p>
                    <p className="text-amber-700 dark:text-amber-300">
                      Upgrade your plan for more capacity.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plan Comparison */}
          <div className="space-y-4">
            <h4 className="font-medium">Available Plans</h4>
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const isDowngrade =
                  plans.findIndex((p) => p.id === currentPlan) >
                  plans.findIndex((p) => p.id === plan.id);

                return (
                  <div
                    key={plan.id}
                    className={`p-4 border rounded-lg ${
                      isCurrent ? "border-primary ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-semibold">{plan.name}</h5>
                        <p className="text-2xl font-bold">
                          ${plan.price}
                          <span className="text-sm font-normal text-muted-foreground">
                            /mo
                          </span>
                        </p>
                      </div>
                      {isCurrent && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </div>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : isDowngrade ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleManageBilling}
                      >
                        Downgrade
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id}
                      >
                        {upgrading === plan.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          `Upgrade to ${plan.name}`
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
