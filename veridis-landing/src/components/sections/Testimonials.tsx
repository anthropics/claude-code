"use client";

import { motion } from "motion/react";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "Veridis let us add purchasing capabilities to our AI assistant in a single afternoon. The guardrails give our users confidence that their agent won't go rogue.",
    author: "Sarah Chen",
    role: "CTO",
    company: "AutoPilot AI",
    avatar: "SC",
  },
  {
    quote:
      "We tried building agent commerce in-house. After 6 months, we switched to Veridis and shipped in 2 weeks. The API design is exactly what developers need.",
    author: "Marcus Johnson",
    role: "Engineering Lead",
    company: "NexGen Agents",
    avatar: "MJ",
  },
  {
    quote:
      "The audit trail and approval workflows sold our enterprise customers immediately. Compliance was our biggest blocker—Veridis solved it.",
    author: "Emily Rodriguez",
    role: "Head of Product",
    company: "AgentFlow",
    avatar: "ER",
  },
];

export function Testimonials() {
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
            Trusted by{" "}
            <span className="text-[#635BFF]">AI-first companies</span>
          </h2>
          <p className="mt-4 text-lg text-[#525F7F]">
            See why leading teams choose Veridis for agent commerce.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative bg-[#F6F9FC] rounded-2xl p-8"
            >
              <Quote className="w-10 h-10 text-[#635BFF]/20 mb-4" />

              <blockquote className="text-[#32325D] mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#635BFF] to-[#8B85FF] flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-[#32325D]">
                    {testimonial.author}
                  </p>
                  <p className="text-sm text-[#525F7F]">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
