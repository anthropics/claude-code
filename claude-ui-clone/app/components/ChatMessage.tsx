'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full px-4 py-6 ${isUser ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800/50'}`}>
      <div className="mx-auto flex w-full max-w-4xl gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-orange-500 text-white'
          }`}>
            {isUser ? 'U' : 'C'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isUser ? 'You' : 'Claude'}
          </div>
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            {isUser ? (
              <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{content}</p>
            ) : (
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-sm" {...props}>
                        {children}
                      </code>
                    );
                  },
                  p({ children }) {
                    return <p className="text-zinc-700 dark:text-zinc-300 mb-4">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside text-zinc-700 dark:text-zinc-300 mb-4">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside text-zinc-700 dark:text-zinc-300 mb-4">{children}</ol>;
                  },
                  h1({ children }) {
                    return <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{children}</h3>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1"></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
