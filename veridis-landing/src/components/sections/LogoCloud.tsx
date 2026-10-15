"use client";

import { motion } from "motion/react";

// Placeholder company names - would be replaced with actual logos
const companies = [
  { name: "Anthropic", initial: "A" },
  { name: "OpenAI", initial: "O" },
  { name: "Cohere", initial: "C" },
  { name: "Mistral", initial: "M" },
  { name: "Perplexity", initial: "P" },
  { name: "Replit", initial: "R" },
];

export function LogoCloud() {
  return (
    <section className="py-16 md:py-20 bg-white border-y border-[#E6EBF1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center text-sm font-medium text-[#8898AA] mb-8"
        >
          Powering AI agents at innovative companies
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center items-center gap-8 md:gap-12 lg:gap-16"
        >
          {companies.map((company, index) => (
            <motion.div
              key={company.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex items-center gap-2 text-[#8898AA] hover:text-[#525F7F] transition-colors"
            >
              {/* Placeholder logo - would be replaced with actual SVG logos */}
              <div className="w-10 h-10 rounded-lg bg-[#F6F9FC] border border-[#E6EBF1] flex items-center justify-center">
                <span className="text-lg font-semibold text-[#525F7F]">
                  {company.initial}
                </span>
              </div>
              <span className="font-medium text-sm hidden sm:block">
                {company.name}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
