'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      // Reset to minimum height first
      textareaRef.current.style.height = '20px';

      // Only grow if there's content
      if (input) {
        const scrollHeight = textareaRef.current.scrollHeight;
        textareaRef.current.style.height = Math.min(Math.max(scrollHeight, 20), 200) + 'px';
      }
    }
  }, [input]);

  return (
    <div className="w-full" style={{ backgroundColor: 'rgb(250, 249, 245)' }}>
      <div className="max-w-3xl mx-auto" style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '12px', paddingRight: '12px' }}>
        <div className="flex flex-col rounded-2xl bg-white shadow-sm" style={{ border: '1px solid rgba(31, 30, 29, 0.15)', paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', gap: '8px' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="How can I help you today?"
            disabled={disabled}
            rows={1}
            className="resize-none bg-transparent text-[15px] leading-6 text-zinc-900 placeholder-zinc-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto w-full border-0"
            style={{ minHeight: '20px', maxHeight: '200px', height: '20px', padding: '0' }}
          />

          <div className="flex items-center justify-end gap-2 flex-wrap">
              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || disabled}
                className="flex items-center justify-center rounded-lg text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                style={{ width: '36px', height: '36px' }}
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
