"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Zap,
  Clock,
  TrendingUp,
  Twitter,
  Linkedin,
  Mail,
  FileText,
  Check,
  ArrowRight,
  Play,
} from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Record Once",
    description: "Upload your podcast, video, or any audio content. Our AI transcribes it in minutes.",
  },
  {
    icon: Zap,
    title: "AI Detects Clips",
    description: "Automatically finds the most engaging moments - the insights, stories, and quotables.",
  },
  {
    icon: FileText,
    title: "Generate Content",
    description: "Turn clips into Twitter threads, LinkedIn posts, newsletters, and more - in your voice.",
  },
  {
    icon: Clock,
    title: "Save 10+ Hours/Week",
    description: "What used to take a full day now takes minutes. Focus on creating, not repurposing.",
  },
];

const platforms = [
  { icon: Twitter, name: "Twitter/X", description: "Threads & tweets" },
  { icon: Linkedin, name: "LinkedIn", description: "Professional posts" },
  { icon: Mail, name: "Newsletter", description: "Email content" },
  { icon: FileText, name: "Blog", description: "SEO articles" },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try it out",
    features: [
      "1 hour of transcription/month",
      "10 AI generations/month",
      "1 brand voice",
      "Basic clip detection",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Creator",
    price: "$29",
    period: "/month",
    description: "For active creators",
    features: [
      "10 hours of transcription/month",
      "100 AI generations/month",
      "3 brand voices",
      "Advanced clip detection",
      "Priority support",
    ],
    cta: "Start Creating",
    popular: true,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For power users",
    features: [
      "50 hours of transcription/month",
      "Unlimited AI generations",
      "10 brand voices",
      "Team collaboration",
      "API access",
      "Custom integrations",
    ],
    cta: "Go Pro",
    popular: false,
  },
];

const testimonials = [
  {
    quote: "I went from spending 6 hours repurposing each episode to 30 minutes. Game changer.",
    author: "Sarah Chen",
    role: "Host, The Growth Show",
  },
  {
    quote: "The AI actually sounds like me. My audience can't tell the difference.",
    author: "Marcus Johnson",
    role: "Creator, 50K followers",
  },
  {
    quote: "Finally, a tool that understands creator workflows. Worth every penny.",
    author: "Emily Rodriguez",
    role: "Content Strategist",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, accessToken, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Mic className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Creator Studio</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
              <Link href="/auth/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/auth/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            AI-Powered Content Repurposing
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            Record once,
            <br />
            <span className="text-primary">content everywhere.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Turn one podcast episode into weeks of content. Our AI learns your voice
            and creates platform-native posts that sound exactly like you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="text-lg px-8">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required. Free plan includes 1 hour of transcription.
          </p>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y bg-muted/30 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">1,000+</div>
              <div className="text-sm text-muted-foreground">Creators</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div>
              <div className="text-3xl font-bold">50,000+</div>
              <div className="text-sm text-muted-foreground">Posts Generated</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div>
              <div className="text-3xl font-bold">10+ hrs</div>
              <div className="text-sm text-muted-foreground">Saved per Week</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From recording to published content in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Upload", desc: "Drop your audio or paste your transcript" },
              { step: "2", title: "Review", desc: "AI detects clips - approve or tweak" },
              { step: "3", title: "Generate", desc: "Create content for any platform" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by creators, for creators. Every feature designed to save you time.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="bg-background rounded-lg p-6 border">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">One Recording, Every Platform</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Generate platform-native content that follows each platform&apos;s best practices
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((platform) => (
              <div key={platform.name} className="flex items-center gap-4 p-4 rounded-lg border bg-background">
                <platform.icon className="h-8 w-8 text-primary" />
                <div>
                  <div className="font-semibold">{platform.name}</div>
                  <div className="text-sm text-muted-foreground">{platform.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Loved by Creators</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="bg-background rounded-lg p-6 border">
                <p className="text-lg mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you&apos;re ready. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg p-8 border ${
                  plan.popular ? "border-primary ring-2 ring-primary" : ""
                } bg-background relative`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to 10x Your Content Output?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join 1,000+ creators who are saving 10+ hours every week.
          </p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Free Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Mic className="h-6 w-6 text-primary" />
              <span className="font-semibold">Creator Studio</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground">Privacy</Link>
              <Link href="#" className="hover:text-foreground">Terms</Link>
              <Link href="#" className="hover:text-foreground">Support</Link>
            </div>
            <div className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Creator Studio. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
