"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button, Badge, CodeBlock } from "@/components/ui";

const heroCode = `import veridis from 'veridis'

const agent = veridis.agent({
  spendingLimit: 500,
  approvalRequired: true,
  merchantCategories: ['retail', 'travel']
})

// Your AI agent can now transact
await agent.purchase({
  item: userRequest.item,
  maxPrice: 150
})`;

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F6F9FC] to-white -z-10" />

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#635BFF]/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#DA7756]/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="default" className="mb-6">
                <Sparkles size={12} className="mr-1" />
                Now in Public Beta
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0A2540] leading-tight tracking-tight"
            >
              Commerce infrastructure{" "}
              <span className="text-[#635BFF]">for AI agents</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg md:text-xl text-[#525F7F] max-w-xl mx-auto lg:mx-0"
            >
              One API to let any AI agent transact. Handle authentication,
              merchant access, and payments with built-in guardrails.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button variant="primary" size="lg">
                Get API Keys
                <ArrowRight size={18} />
              </Button>
              <Button variant="outline" size="lg">
                Read Documentation
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 flex items-center gap-6 justify-center lg:justify-start text-sm text-[#8898AA]"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#24B47E]" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#24B47E]" />
                <span>PCI-DSS Level 1</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Code Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-[#635BFF]/20 to-[#DA7756]/20 rounded-2xl blur-xl -z-10" />
            <CodeBlock
              code={heroCode}
              language="javascript"
              showLineNumbers={true}
              className="shadow-2xl"
            />

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 bg-white rounded-lg shadow-lg p-3 border border-[#E6EBF1]"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#24B47E]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#24B47E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#32325D]">Transaction Complete</p>
                  <p className="text-xs text-[#8898AA]">$127.50 approved</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
