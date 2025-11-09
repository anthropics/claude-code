'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ClaudeLogo from './ClaudeLogo';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  username?: string;
  toolUses?: { tool: string; toolUseId: string }[];
  contentBlocks?: Array<{type: 'text', content: string} | {type: 'tool', tool: string, toolUseId: string}>;
}

export default function ChatMessage({ role, content, isStreaming, username = 'You', toolUses, contentBlocks }: ChatMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const initials = username
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Create utterance without setting a specific voice
    // This allows the browser/OS to use the system default voice
    const utterance = new SpeechSynthesisUtterance(content);

    // Set language to match browser language for better voice selection
    utterance.lang = navigator.language || 'en-US';

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const firstName = username.split(' ')[0];

  return (
    <div className="group w-full py-6">
      <div className="max-w-3xl mx-auto px-4 sm:px-6" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
        <div className="flex gap-3 sm:gap-4">
        {/* Name label */}
        <div className="flex-shrink-0">
          <div className="text-sm font-bold text-zinc-900">
            {isUser ? firstName : 'AIVA'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Render content blocks if available (streaming with inline tools) */}
          {contentBlocks && contentBlocks.length > 0 ? (
            <div className="space-y-3">
              {contentBlocks.map((block, idx) => (
                block.type === 'tool' ? (
                  <div key={idx} className="inline-block px-2 py-1 text-xs text-zinc-600 bg-zinc-100 border border-zinc-200 rounded my-2">
                    Used {block.tool}
                  </div>
                ) : (
                  <div key={idx} className="prose prose-zinc max-w-none text-[15px] break-words">
                    <div className="break-words overflow-wrap-anywhere">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div className="overflow-x-auto">
                                <SyntaxHighlighter
                                  style={oneDark}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-lg my-3"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-sm font-mono break-all" {...props}>
                                {children}
                              </code>
                            );
                          },
                          p({ children }) {
                            return <p className="text-zinc-900 mb-3 leading-6 break-words">{children}</p>;
                          },
                        }}
                      >
                        {block.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )
              ))}
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-text-bottom"></span>
              )}
            </div>
          ) : (
            <>

              <div className="prose prose-zinc max-w-none text-[15px] break-words">
                {isUser ? (
                  <p className="text-zinc-900 whitespace-pre-wrap break-words m-0 leading-6">{content}</p>
                ) : (
                  <div className="break-words overflow-wrap-anywhere">
                    <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="overflow-x-auto">
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            className="rounded-lg my-3"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-sm font-mono break-all" {...props}>
                          {children}
                        </code>
                      );
                    },
                    p({ children }) {
                      return <p className="text-zinc-900 mb-3 leading-6 break-words">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside text-zinc-900 mb-3 space-y-1.5 break-words">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside text-zinc-900 mb-3 space-y-1.5 break-words">{children}</ol>;
                    },
                    h1({ children }) {
                      return <h1 className="text-2xl font-bold text-zinc-900 mb-3 mt-4 break-words">{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className="text-xl font-bold text-zinc-900 mb-2.5 mt-4 break-words">{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className="text-lg font-semibold text-zinc-900 mb-2 mt-3 break-words">{children}</h3>;
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto" style={{ margin: '14px 0', padding: '6px 0' }}>
                          <table className="whitespace-nowrap" style={{ borderCollapse: 'collapse' }}>
                            {children}
                          </table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return <thead>{children}</thead>;
                    },
                    tbody({ children }) {
                      return <tbody>{children}</tbody>;
                    },
                    tr({ children }) {
                      return <tr className="border-b border-zinc-200">{children}</tr>;
                    },
                    th({ children }) {
                      return (
                        <th className="text-left text-sm font-medium text-zinc-700 border-b-2 border-zinc-300" style={{ padding: '5px 10px 5px 0' }}>
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td className="text-sm text-zinc-900" style={{ padding: '5px 10px 5px 0' }}>
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-text-bottom"></span>
                )}
              </div>
            )}
          </div>
            </>
          )}

          {/* Action Buttons (only for assistant messages) */}
          {!isUser && !isStreaming && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
                title="Copy"
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleSpeak}
                className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-600 hover:bg-zinc-100 transition-colors"
                title={isSpeaking ? "Stop speaking" : "Read aloud"}
              >
                {isSpeaking ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
