'use client';

import { useState, useEffect, useRef } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import Login from './components/Login';
import Settings from './components/Settings';
import ClaudeLogo from './components/ClaudeLogo';
import ToolUsage from './components/ToolUsage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUses?: { tool: string; toolUseId: string }[];
  contentBlocks?: Array<{type: 'text', content: string} | {type: 'tool', tool: string, toolUseId: string}>;
}

interface Conversation {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  sessionId?: string;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingBlocks, setStreamingBlocks] = useState<Array<{type: 'text', content: string} | {type: 'tool', tool: string, toolUseId: string}>>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [userFirstName, setUserFirstName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine backend URL based on environment
  const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:3001`
    : 'http://localhost:3001';

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUsername = localStorage.getItem('username');
    if (savedToken && savedUsername) {
      setToken(savedToken);
      setUsername(savedUsername);
    }
  }, []);

  // Load user's first name from config
  useEffect(() => {
    const loadUserConfig = async () => {
      if (!token || !username) return;

      try {
        const response = await fetch(`${BACKEND_URL}/api/user/config/${username.toLowerCase()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const config = await response.json();
          setUserFirstName(config.firstName || username);
        }
      } catch (error) {
        console.error('Failed to load user config:', error);
      }
    };

    loadUserConfig();
  }, [token, username, BACKEND_URL]);

  const handleLogin = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setConversations([]);
    setCurrentConversationId(null);
  };

  // Load conversations from backend
  useEffect(() => {
    if (!token) return;

    const loadConversations = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/conversations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setConversations(data.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp)
          })));
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    loadConversations();
  }, [token, BACKEND_URL]);

  // Save conversations to backend
  useEffect(() => {
    if (!token) return;
    if (conversations.length === 0) return;

    const saveConversations = async () => {
      try {
        await fetch(`${BACKEND_URL}/api/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(conversations)
        });
      } catch (error) {
        console.error('Failed to save conversations:', error);
      }
    };

    saveConversations();
  }, [conversations, token, BACKEND_URL]);

  // Auto-scroll to bottom only when streaming or user is near bottom
  useEffect(() => {
    if (streamingContent || !messagesEndRef.current) return;

    const scrollContainer = messagesEndRef.current.parentElement;
    if (!scrollContainer) return;

    // Only auto-scroll if user is near the bottom (within 100px)
    const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;

    if (isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages]);

  // Always scroll when streaming - use instant scroll to keep up with fast updates
  useEffect(() => {
    if (streamingContent && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [streamingContent]);

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New conversation',
      timestamp: new Date(),
      messages: [],
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setStreamingContent('');
    // Close sidebar on mobile when a chat is selected
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all conversations? This cannot be undone.')) {
      setConversations([]);
      setCurrentConversationId(null);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        title: content.slice(0, 50),
        timestamp: new Date(),
        messages: [],
      };
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversationId(newConv.id);
      // Use the new conversation ID directly
      await sendMessageWithConversation(content, newConv.id);
      return;
    }
    await sendMessageWithConversation(content, currentConversationId);
  };

  const sendMessageWithConversation = async (content: string, conversationId: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    // Add user message
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              title: conv.messages.length === 0 ? content.slice(0, 50) : conv.title,
            }
          : conv
      )
    );

    setIsLoading(true);
    setStreamingContent('');
    setStreamingBlocks([]);
    setIsThinking(true);

    // Get the current conversation's messages for context
    const conversation = conversations.find(c => c.id === conversationId);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: content,
          sessionId: conversation?.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let contentBlocks: Array<{type: 'text', content: string, blockIndex: number} | {type: 'tool', tool: string, toolUseId: string, blockIndex: number}> = [];
      let currentTextContent = '';
      let currentBlockIndex = -1;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                console.error('Stream error:', data.error);
                break;
              }

              // Handle different message types from backend
              if (data.type === 'session_id') {
                // Store the session ID for this conversation
                setConversations(prev =>
                  prev.map(conv =>
                    conv.id === conversationId
                      ? { ...conv, sessionId: data.sessionId }
                      : conv
                  )
                );
                continue;
              }

              if (data.type === 'text_block_start') {
                currentTextContent = '';
                currentBlockIndex = data.blockIndex;
              }

              if (data.type === 'text' && data.content) {
                currentTextContent += data.content;
                setIsThinking(false); // Stop thinking indicator when text starts
                // Update streaming blocks with current text
                const sortedBlocks = [...contentBlocks].sort((a, b) => a.blockIndex - b.blockIndex);
                const displayBlocks = sortedBlocks.map(b => b.type === 'text' ? {type: 'text' as const, content: b.content} : {type: 'tool' as const, tool: b.tool, toolUseId: b.toolUseId});
                if (currentTextContent) {
                  displayBlocks.push({type: 'text' as const, content: currentTextContent});
                }
                setStreamingBlocks(displayBlocks);
              }

              if (data.type === 'text_block_end') {
                if (currentTextContent) {
                  contentBlocks.push({ type: 'text', content: currentTextContent, blockIndex: currentBlockIndex });
                  currentTextContent = '';
                  // Update display blocks
                  const sortedBlocks = [...contentBlocks].sort((a, b) => a.blockIndex - b.blockIndex);
                  setStreamingBlocks(sortedBlocks.map(b => b.type === 'text' ? {type: 'text' as const, content: b.content} : {type: 'tool' as const, tool: b.tool, toolUseId: b.toolUseId}));
                }
              }

              if (data.type === 'tool_use') {
                console.log('[FRONTEND] Received tool_use:', data.tool, 'at index', data.blockIndex);

                // Check if we already have this tool (prevent duplicates)
                const alreadyExists = contentBlocks.some(b => b.type === 'tool' && b.toolUseId === data.toolUseId);
                if (alreadyExists) {
                  console.log('[FRONTEND] Tool already exists, skipping:', data.toolUseId);
                  continue;
                }

                // Finish any current text block
                if (currentTextContent) {
                  contentBlocks.push({ type: 'text', content: currentTextContent, blockIndex: currentBlockIndex });
                  currentTextContent = '';
                }
                contentBlocks.push({ type: 'tool', tool: data.tool, toolUseId: data.toolUseId, blockIndex: data.blockIndex });
                setIsThinking(false); // No longer just thinking, actively using tools

                // Update display blocks
                const sortedBlocks = [...contentBlocks].sort((a, b) => a.blockIndex - b.blockIndex);
                const displayBlocks = sortedBlocks.map(b => b.type === 'text' ? {type: 'text' as const, content: b.content} : {type: 'tool' as const, tool: b.tool, toolUseId: b.toolUseId});
                console.log('[FRONTEND] Setting streamingBlocks:', displayBlocks);
                setStreamingBlocks(displayBlocks);
              }

              if (data.type === 'result' || data.done) {
                // Finish any remaining text block
                if (currentTextContent) {
                  contentBlocks.push({ type: 'text', content: currentTextContent, blockIndex: currentBlockIndex });
                }

                // DON'T SORT! Keep blocks in the exact order they were added
                // Build final message content
                const finalContent = contentBlocks.filter(b => b.type === 'text').map(b => b.content).join('\n\n');

                // Build display blocks WITHOUT sorting (preserving exact streaming order)
                const displayBlocks = contentBlocks.map(b =>
                  b.type === 'text'
                    ? {type: 'text' as const, content: b.content}
                    : {type: 'tool' as const, tool: b.tool, toolUseId: b.toolUseId}
                );

                console.log('[FRONTEND] Final displayBlocks:', displayBlocks);

                // Clear streaming state first to avoid duplication
                setStreamingContent('');
                setStreamingBlocks([]);
                setIsThinking(false);

                // Then add the completed message
                const assistantMessage: Message = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: finalContent,
                  contentBlocks: displayBlocks.length > 0 ? displayBlocks : undefined,
                };

                setConversations(prev =>
                  prev.map(conv =>
                    conv.id === conversationId
                      ? { ...conv, messages: [...conv.messages, assistantMessage] }
                      : conv
                  )
                );
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please make sure you have set the ANTHROPIC_API_KEY environment variable.',
      };
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, errorMessage] }
            : conv
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingBlocks([]);
      setIsThinking(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'rgb(250, 249, 245)' }}>
      {/* Fixed Header - Always visible */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center h-12"
        style={{
          backgroundColor: 'rgb(250, 249, 245)',
          paddingLeft: '16px',
          paddingRight: '16px'
        }}
      >
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="rounded-md p-2 hover:bg-zinc-100 transition-colors"
          aria-label={sidebarCollapsed ? "Open menu" : "Close menu"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-6 w-6 text-zinc-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      {/* Main content area below header */}
      <div className="flex flex-1 overflow-hidden" style={{ marginTop: '48px' }}>
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onClearAll={handleClearAll}
          username={username || 'User'}
          onOpenSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {/* Messages - scrollable area that respects fixed header (48px) and input box */}
          <div
            style={{
              position: 'fixed',
              top: '48px',
              bottom: '0',
              left: isMobile ? '0' : (sidebarCollapsed ? '0' : '256px'),
              right: '0',
              overflowY: 'auto',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              paddingTop: '20px',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 140px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'left 0.3s ease',
              zIndex: 10
            }}
          >
          <div style={{ width: '100%', maxWidth: '800px' }}>
            {!currentConversation || currentConversation.messages.length === 0 ? (
              <div className="flex items-center justify-center" style={{ paddingLeft: '24px', paddingRight: '24px', minHeight: 'calc(100vh - 228px)' }}>
                <div className="text-center max-w-2xl mx-auto">
                  <h2 className="mb-3 text-3xl font-semibold text-zinc-900">
                    How can I help you today?
                  </h2>
                  <p className="text-zinc-600 max-w-md mx-auto text-sm">
                    I'm AIVA, an AI assistant. I can help with writing, analysis, math, coding, and more.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {currentConversation.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    username={userFirstName || username || 'User'}
                    toolUses={message.toolUses}
                    contentBlocks={message.contentBlocks}
                  />
                ))}
                {/* Thinking indicator */}
                {isThinking && streamingBlocks.length === 0 && (
                  <div className="group w-full py-6">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex-shrink-0">
                          <div className="text-sm font-bold text-zinc-900">AIVA</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-zinc-500 text-sm">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span>Thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming content with inline tools */}
                {streamingBlocks.length > 0 && (
                  <ChatMessage
                    role="assistant"
                    content=""
                    isStreaming={true}
                    username={userFirstName || username || 'User'}
                    contentBlocks={streamingBlocks}
                  />
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          </div>
        </div>

        {/* Input - FIXED at bottom */}
        <div style={{
          position: 'fixed',
          bottom: '0',
          left: isMobile ? '0' : (sidebarCollapsed ? '0' : '256px'),
          right: '0',
          zIndex: 30,
          transition: 'left 0.3s ease',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && token && username && (
        <Settings
          token={token}
          currentUsername={username}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
