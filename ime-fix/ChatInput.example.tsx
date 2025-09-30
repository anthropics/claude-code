/**
 * IME-aware chat input component example
 * Intended for use in Claude Code VSCode extension
 */

import React from 'react';
import { useImeAwareSubmit } from './useImeAwareSubmit';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  placeholder = 'Type a message...'
}) => {
  const {
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    isComposing
  } = useImeAwareSubmit({
    onSubmit: onSendMessage
  });

  return (
    <div className="chat-input-container">
      <input
        type="text"
        className="chat-input"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        aria-label="Chat message input"
      />
      <div className="input-status">
        {isComposing && (
          <span className="composing-indicator">Composing...</span>
        )}
      </div>
    </div>
  );
};