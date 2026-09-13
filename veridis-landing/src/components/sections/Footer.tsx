"use client";

import { motion } from "motion/react";
import { Github, Twitter, Linkedin } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Security", href: "#security" },
    { label: "Enterprise", href: "#enterprise" },
  ],
  Developers: [
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/api" },
    { label: "SDKs", href: "/sdks" },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "DPA", href: "/dpa" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com/veridis", label: "Twitter" },
  { icon: Github, href: "https://github.com/veridis", label: "GitHub" },
  { icon: Linkedin, href: "https://linkedin.com/company/veridis", label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#E6EBF1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Logo and description */}
          <div className="col-span-2">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#635BFF] to-[#8B85FF] flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-xl font-semibold text-[#32325D]">
                Veridis
              </span>
            </a>
            <p className="text-sm text-[#525F7F] mb-6 max-w-xs">
              Commerce infrastructure for AI agents. Enable any AI to transact
              with built-in guardrails and complete visibility.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-[#F6F9FC] flex items-center justify-center text-[#525F7F] hover:bg-[#635BFF] hover:text-white transition-colors"
                  aria-label={social.label}
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-[#32325D] mb-4">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#525F7F] hover:text-[#635BFF] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[#E6EBF1]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[#8898AA]">
              &copy; {new Date().getFullYear()} Veridis. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[#8898AA]">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#24B47E]" />
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
