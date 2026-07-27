"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startConsultation() {
    setStarted(true);
    setIsLoading(true);

    const initMessages: Message[] = [
      { role: "user", content: "Hello, I'd like to learn about Farm Bureau benefits." },
    ];

    await streamResponse(initMessages);
  }

  async function streamResponse(msgs: Message[]) {
    setIsLoading(true);
    let assistantText = "";

    setMessages((prev) => [
      ...prev.slice(0, prev.length - (prev[prev.length - 1]?.role === "assistant" ? 1 : 0)),
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });

      if (!res.ok) throw new Error("API error");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "I'm sorry, something went wrong. Please check your connection and try again.",
        };
        return updated;
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await streamResponse(updatedMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as React.FormEvent);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-fb-green-700 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <span className="text-fb-green-700 font-bold text-lg">FB</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Louisiana Farm Bureau Benefits
            </h1>
            <p className="text-fb-green-200 text-sm">
              Personalized consultation with Garrett Gardner
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        {!started ? (
          /* Landing / intro screen */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-20 h-20 bg-fb-green-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-fb-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-fb-green-800 mb-3">
              Find Your Farm Bureau Benefits
            </h2>
            <p className="text-gray-600 max-w-md mb-2">
              Answer a few quick questions and get a personalized look at which
              Louisiana Farm Bureau benefits matter most for your situation.
            </p>
            <p className="text-gray-500 text-sm max-w-md mb-8">
              Whether you&apos;re a farmer, rural homeowner, small business owner,
              or just a Louisiana resident curious about membership — this is for
              you.
            </p>
            <button
              onClick={startConsultation}
              className="bg-fb-green-600 hover:bg-fb-green-700 text-white font-semibold px-8 py-3 rounded-lg shadow transition-colors text-lg"
            >
              Start My Free Consultation
            </button>
            <div className="mt-10 pt-8 border-t border-gray-200 text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-1">
                Garrett Gardner
              </p>
              <p>Louisiana Farm Bureau Insurance Agent</p>
              <div className="flex flex-wrap gap-4 justify-center mt-2">
                <a
                  href="tel:2257666565"
                  className="text-fb-green-600 hover:underline"
                >
                  (225) 766-6565
                </a>
                <a
                  href="mailto:ggardner@sfbcic.com"
                  className="text-fb-green-600 hover:underline"
                >
                  ggardner@sfbcic.com
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Chat interface */
          <div className="flex-1 flex flex-col">
            <div className="flex-1 space-y-4 mb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 bg-fb-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 mt-1">
                      FB
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-fb-green-600 text-white rounded-tr-sm"
                        : "bg-white border border-gray-200 shadow-sm rounded-tl-sm text-gray-800"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose-chat text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {isLoading && i === messages.length - 1 && msg.content === "" && (
                          <span className="inline-flex gap-1 mt-1">
                            <span className="w-2 h-2 bg-fb-green-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-fb-green-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-fb-green-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="sticky bottom-0 bg-gray-50 pt-2 pb-4">
              <form onSubmit={sendMessage} className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response..."
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fb-green-500 focus:border-transparent disabled:opacity-50 bg-white shadow-sm"
                  style={{ maxHeight: "200px" }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 bg-fb-green-600 hover:bg-fb-green-700 disabled:bg-gray-300 text-white rounded-xl px-4 py-3 transition-colors shadow-sm"
                  aria-label="Send"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </form>
              <p className="text-xs text-gray-400 text-center mt-2">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>
            Garrett Gardner · Louisiana Farm Bureau Insurance Agent ·{" "}
            <a href="tel:2257666565" className="text-fb-green-600 hover:underline">
              (225) 766-6565
            </a>{" "}
            ·{" "}
            <a
              href="mailto:ggardner@sfbcic.com"
              className="text-fb-green-600 hover:underline"
            >
              ggardner@sfbcic.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
