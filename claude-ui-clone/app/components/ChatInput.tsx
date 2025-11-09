'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (input.trim() && !disabled) {
      setIsUploading(true);
      let finalMessage = input;

      // Upload files first if any are pending
      if (pendingFiles.length > 0) {
        const uploadedPaths = await uploadFiles(pendingFiles);
        if (uploadedPaths.length > 0) {
          const filePathsText = uploadedPaths.join(', ');
          finalMessage = `${input}\n\nAttached files: ${filePathsText}`;
        }
      }

      onSend(finalMessage);
      setInput('');
      setPendingFiles([]);
      setIsUploading(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const uploadedPaths: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://localhost:3001/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await response.json();
        if (data.success) {
          uploadedPaths.push(data.relativePath);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    return uploadedPaths;
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fileArray = Array.from(files);
      setPendingFiles(prev => [...prev, ...fileArray]);
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
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
        <div
          className="flex flex-col rounded-2xl bg-white shadow-sm cursor-text"
          style={{
            border: isDragging ? '2px solid rgb(59, 130, 246)' : '1px solid rgba(31, 30, 29, 0.15)',
            paddingLeft: '12px',
            paddingRight: '12px',
            paddingTop: '8px',
            paddingBottom: '8px',
            gap: '8px',
            backgroundColor: isDragging ? 'rgb(239, 246, 255)' : 'white'
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => textareaRef.current?.focus()}
        >
          {/* Display pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-col gap-1 pb-2 border-b border-zinc-200">
              <div className="text-xs text-zinc-500">Files to attach:</div>
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <span>{file.name}</span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-blue-500 hover:text-blue-700 ml-1"
                      aria-label="Remove file"
                      disabled={isUploading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                disabled={!input.trim() || disabled || isUploading}
                className="flex items-center justify-center rounded-lg text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                style={{ width: '36px', height: '36px' }}
                aria-label="Send message"
              >
                {isUploading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
