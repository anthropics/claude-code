"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Sandbox",
    price: "Free",
    description: "Perfect for testing and development",
    features: [
      "1,000 test transactions/month",
      "Full API access",
      "Community support",
      "Development dashboard",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Growth",
    price: "$0.10",
    priceUnit: "/transaction",
    description: "For startups ready to go live",
    features: [
      "Unlimited transactions",
      "Production environment",
      "Email support",
      "Basic analytics",
      "Webhook integrations",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    name: "Scale",
    price: "Custom",
    description: "For high-volume applications",
    features: [
      "Volume discounts",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540]">
            Simple, transparent{" "}
            <span className="text-[#635BFF]">pricing</span>
          </h2>
          <p className="mt-4 text-lg text-[#525F7F]">
            Pay only for completed transactions. No surprise bills, no hidden
            fees.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-6">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn(
                "relative rounded-2xl p-8",
                tier.popular
                  ? "bg-[#0A2540] text-white ring-2 ring-[#635BFF]"
                  : "bg-white border border-[#E6EBF1]"
              )}
            >
              {tier.popular && (
                <Badge
                  variant="default"
                  animated={false}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#635BFF] text-white border-none"
                >
                  Most Popular
                </Badge>
              )}

              <div className="mb-6">
                <h3
                  className={cn(
                    "text-xl font-semibold mb-2",
                    tier.popular ? "text-white" : "text-[#32325D]"
                  )}
                >
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-4xl font-bold",
                      tier.popular ? "text-white" : "text-[#0A2540]"
                    )}
                  >
                    {tier.price}
                  </span>
                  {tier.priceUnit && (
                    <span
                      className={cn(
                        "text-sm",
                        tier.popular ? "text-white/70" : "text-[#525F7F]"
                      )}
                    >
                      {tier.priceUnit}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    tier.popular ? "text-white/70" : "text-[#525F7F]"
                  )}
                >
                  {tier.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        tier.popular ? "text-[#635BFF]" : "text-[#24B47E]"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        tier.popular ? "text-white/90" : "text-[#525F7F]"
                      )}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? "primary" : "outline"}
                size="lg"
                className="w-full"
              >
                {tier.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
