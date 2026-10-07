"use client";

import { motion } from "motion/react";
import {
  Shield,
  Zap,
  Eye,
  Lock,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui";

const features = [
  {
    icon: Shield,
    title: "Built-in Guardrails",
    description:
      "Set spending limits, approval thresholds, and merchant restrictions. Every transaction is validated against your rules before execution.",
  },
  {
    icon: Zap,
    title: "Instant Integration",
    description:
      "Connect your AI agent to commerce in minutes with our SDK. Supports Python, Node.js, and REST APIs out of the box.",
  },
  {
    icon: Eye,
    title: "Complete Visibility",
    description:
      "Full audit trail of every agent action. See exactly what your agents do with real-time dashboards and detailed logs.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description:
      "SOC 2 Type II certified, PCI-DSS Level 1 compliant. Your data is encrypted at rest and in transit, never used for training.",
  },
  {
    icon: RefreshCw,
    title: "Approval Workflows",
    description:
      "Configure real-time approval hooks for high-value transactions. Integrate with Slack, email, or your own systems.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description:
      "Track agent performance, spending patterns, and merchant preferences. Export data to your BI tools via API.",
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-32 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540]">
            Everything you need for{" "}
            <span className="text-[#635BFF]">agentic commerce</span>
          </h2>
          <p className="mt-4 text-lg text-[#525F7F]">
            Veridis handles the complex infrastructure so you can focus on
            building intelligent agents that delight your users.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.2 },
            },
          }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <Card variant="bordered" hover className="h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-[#635BFF]/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-[#635BFF]" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
