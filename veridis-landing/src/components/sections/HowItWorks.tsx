"use client";

import { motion } from "motion/react";
import { UserPlus, Settings, ShoppingCart } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Your Agent",
    description:
      "Register your AI agent with Veridis and get API credentials. Define the agent's identity and purpose.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configure Guardrails",
    description:
      "Set spending limits, approval workflows, and merchant restrictions. Your rules, your control.",
  },
  {
    icon: ShoppingCart,
    step: "03",
    title: "Enable Commerce",
    description:
      "Your agent can now browse, compare, purchase, and manage subscriptions on behalf of users.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540]">
            Get started in{" "}
            <span className="text-[#635BFF]">three simple steps</span>
          </h2>
          <p className="mt-4 text-lg text-[#525F7F]">
            From zero to transacting agents in minutes. No complex integrations,
            no lengthy onboarding.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-24 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-[#635BFF]/0 via-[#635BFF]/30 to-[#635BFF]/0" />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative text-center"
              >
                {/* Step number */}
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-[#F6F9FC] border border-[#E6EBF1] flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-[#635BFF]" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#635BFF] text-white text-sm font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-[#32325D] mb-3">
                  {step.title}
                </h3>
                <p className="text-[#525F7F]">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
