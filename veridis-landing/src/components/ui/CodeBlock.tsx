"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  variant?: "dark" | "light";
}

// Simple syntax highlighting for common patterns
function highlightCode(code: string): string {
  return code
    // Keywords
    .replace(
      /\b(import|from|const|let|var|function|async|await|return|if|else|for|while|class|extends|new|this|export|default)\b/g,
      '<span class="code-keyword">$1</span>'
    )
    // Strings (double quotes)
    .replace(/"([^"\\]|\\.)*"/g, '<span class="code-string">"$&"</span>'.replace('"$&"', '$&'))
    // Strings (single quotes)
    .replace(/'([^'\\]|\\.)*'/g, '<span class="code-string">$&</span>')
    // Template literals
    .replace(/`([^`\\]|\\.)*`/g, '<span class="code-string">$&</span>')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="code-number">$1</span>')
    // Function calls
    .replace(/(\w+)(\s*\()/g, '<span class="code-function">$1</span>$2')
    // Comments
    .replace(/(\/\/.*$)/gm, '<span class="code-comment">$1</span>')
    // Object properties
    .replace(/(\w+):/g, '<span class="code-property">$1</span>:');
}

export function CodeBlock({
  code,
  language = "javascript",
  showLineNumbers = true,
  className,
  variant = "dark",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");
  const highlightedCode = highlightCode(code);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden",
        variant === "dark"
          ? "bg-[#1A1F36]"
          : "bg-[#F6F9FC] border border-[#E6EBF1]",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 border-b",
          variant === "dark"
            ? "border-white/10 bg-white/5"
            : "border-[#E6EBF1] bg-[#F6F9FC]"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
          </div>
          <span
            className={cn(
              "text-xs font-mono ml-2",
              variant === "dark" ? "text-white/50" : "text-[#8898AA]"
            )}
          >
            {language}
          </span>
        </div>

        <motion.button
          onClick={handleCopy}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            variant === "dark"
              ? "hover:bg-white/10 text-white/50 hover:text-white"
              : "hover:bg-[#E6EBF1] text-[#8898AA] hover:text-[#525F7F]"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check size={14} className="text-[#24B47E]" />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Copy size={14} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code
            className={variant === "dark" ? "text-[#E6E6E6]" : "text-[#32325D]"}
          >
            {showLineNumbers ? (
              <div className="flex">
                {/* Line numbers */}
                <div
                  className={cn(
                    "select-none pr-4 text-right",
                    variant === "dark" ? "text-white/30" : "text-[#8898AA]"
                  )}
                >
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {/* Code */}
                <div
                  className="flex-1"
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Inline code component
export function InlineCode({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "px-1.5 py-0.5 rounded text-sm font-mono bg-[#F6F9FC] text-[#635BFF] border border-[#E6EBF1]",
        className
      )}
    >
      {children}
    </code>
  );
}
