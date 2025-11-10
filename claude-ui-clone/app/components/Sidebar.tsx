'use client';

import { useState, useEffect } from 'react';
import FileTree from './FileTree';

interface Conversation {
  id: string;
  title: string;
  timestamp: Date;
}

interface UserConfig {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
}

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onClearAll?: () => void;
  username?: string;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onClearAll,
  username = 'User',
  onOpenSettings,
  onLogout,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showFileTree, setShowFileTree] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = onToggleCollapse || setInternalIsCollapsed;

  // Swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    if (isLeftSwipe && isMobile && !isCollapsed) {
      setIsCollapsed(true);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && !isCollapsed) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      // Re-enable body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [isMobile, isCollapsed]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadUserConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('No token found');
          return;
        }

        const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
          ? `http://${window.location.hostname}:3001`
          : 'http://localhost:3001';

        console.log('Loading config for username:', username, 'from:', BACKEND_URL);
        const response = await fetch(`${BACKEND_URL}/api/user/config/${username.toLowerCase()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Response status:', response.status);
        if (response.ok) {
          const config = await response.json();
          console.log('User config loaded:', config);
          setUserConfig(config);
        } else {
          console.error('Failed to fetch config:', response.status);
        }
      } catch (error) {
        console.error('Failed to load user config:', error);
      }
    };

    if (username) {
      loadUserConfig();
    }
  }, [username]);

  const displayName = `${userConfig?.firstName || ''} ${userConfig?.lastName || ''}`.trim();
  const displayTitle = userConfig?.title || '';

  console.log('userConfig:', userConfig);
  console.log('displayName:', displayName);
  console.log('displayTitle:', displayTitle);

  const initials = displayName
    .split(' ')
    .filter(n => n)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && isMobile && (
        <div
          className="fixed bg-black/50"
          style={{
            top: '48px',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40
          }}
          onClick={() => setIsCollapsed(true)}
        />
      )}

      <nav
        className="flex flex-col border-r transition-all duration-300 ease-in-out"
        style={{
          backgroundColor: isMobile ? 'transparent' : 'rgb(250, 249, 245)',
          borderColor: 'rgba(31, 30, 29, 0.15)',
          width: isCollapsed ? '0px' : '256px',
          minWidth: isCollapsed ? '0px' : '256px',
          overflow: 'hidden',
          position: isMobile ? 'fixed' : 'relative',
          zIndex: isMobile ? 9998 : 'auto',
          left: 0,
          top: isMobile ? '48px' : 0,
          bottom: isMobile ? 0 : 'auto',
          height: isMobile ? 'auto' : '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
      {showFileTree ? (
        <FileTree onBack={() => setShowFileTree(false)} />
      ) : (
        <>
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, backgroundColor: isMobile ? 'rgb(250, 249, 245)' : 'transparent' }}>
          {/* Navigation Links */}
          <div className="flex-shrink-0 space-y-0.5" style={{ paddingLeft: isMobile ? '16px' : '42px', paddingRight: '0', paddingTop: '0' }}>
            <button
              onClick={() => {
                setShowFileTree(true);
                if (isMobile) setIsCollapsed(true);
              }}
              className="flex w-full items-center gap-3 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
              style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: isMobile ? '8px' : '4px', paddingBottom: isMobile ? '8px' : '4px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              <span>Files</span>
            </button>

            <div className="flex items-center justify-between" style={{ paddingRight: '12px' }}>
              <button
                className="flex items-center gap-3 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: isMobile ? '8px' : '4px', paddingBottom: isMobile ? '8px' : '4px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
                <span>Chats</span>
              </button>
              <button
                onClick={() => {
                  onNewConversation();
                  if (isMobile) setIsCollapsed(true);
                }}
                className="rounded-lg hover:bg-zinc-100 transition-colors flex items-center justify-center"
                style={{ width: '32px', height: '32px' }}
                aria-label="New chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Recents Section */}
          <div className="mt-3" style={{ paddingLeft: isMobile ? '16px' : '42px', paddingRight: '4px' }}>
            <div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="group relative flex items-center justify-between rounded-lg text-sm cursor-pointer transition-colors"
                  style={{
                    paddingLeft: '16px',
                    paddingRight: '0',
                    paddingTop: isMobile ? '8px' : '4px',
                    paddingBottom: isMobile ? '8px' : '4px',
                    backgroundColor: conv.id === currentConversationId ? 'rgb(244, 244, 245)' : 'transparent'
                  }}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    if (isMobile) setIsCollapsed(true);
                  }}
                  onMouseEnter={(e) => {
                    if (conv.id !== currentConversationId) {
                      e.currentTarget.style.backgroundColor = 'rgb(244, 244, 245)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (conv.id !== currentConversationId) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span className="flex-1 truncate text-zinc-900">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-zinc-200 transition-opacity flex-shrink-0"
                    aria-label="Delete conversation"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-4 w-4 text-zinc-600"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>

          {/* Profile Menu at bottom */}
          <div className="relative flex-shrink-0" style={{
            borderTop: '1px solid rgba(31, 30, 29, 0.15)',
            paddingTop: '2px',
            paddingBottom: isMobile ? '8px' : 'calc(8px + env(safe-area-inset-bottom))',
            paddingLeft: isMobile ? '16px' : '42px',
            paddingRight: '0',
            backgroundColor: isMobile ? 'rgb(250, 249, 245)' : 'transparent'
          }}>
            <div>
              <div className="flex items-center justify-between" style={{ paddingRight: '12px' }}>
                <button
                  onClick={() => {
                    if (username === 'mike' && onOpenSettings) {
                      onOpenSettings();
                      if (isMobile) setIsCollapsed(true);
                    }
                  }}
                  className="flex items-center gap-3 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                  style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: isMobile ? '8px' : '4px', paddingBottom: isMobile ? '8px' : '4px' }}
                >
                  {username === 'mike' && onOpenSettings && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                  <span>{displayName}</span>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                    style={{ width: '32px', height: '32px' }}
                    aria-label="Log out"
                    title="Log out"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-5 w-5 text-zinc-600 dark:text-zinc-400"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-xs text-zinc-500" style={{ paddingLeft: username === 'mike' && onOpenSettings ? '48px' : '32px', marginTop: '-8px' }}>{displayTitle}</div>
            </div>
          </div>
        </>
      )}
    </nav>
    </>
  );
}
