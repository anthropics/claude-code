'use client';

import { useState, useEffect } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  onBack: () => void;
}

export default function FileTree({ onBack }: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFileTree = async () => {
      try {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        if (!token || !username) return;

        const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
          ? `http://${window.location.hostname}:3001`
          : 'http://localhost:3001';

        const response = await fetch(`${BACKEND_URL}/api/files/tree`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setFileTree(data);
        }
      } catch (error) {
        console.error('Failed to load file tree:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFileTree();
  }, []);

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isDirectory = node.type === 'directory';

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-100 cursor-pointer text-sm"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => isDirectory && toggleExpanded(node.path)}
        >
          {isDirectory && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4 text-zinc-500 transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          {!isDirectory && <div style={{ width: '16px' }} />}
          {isDirectory ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-zinc-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-zinc-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
          <span className="text-zinc-900 truncate">{node.name}</span>
        </div>
        {isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="space-y-1.5" style={{ paddingLeft: '16px', paddingRight: '12px', paddingTop: '16px' }}>
        <button
          onClick={onBack}
          className="flex w-full items-center gap-3 rounded-lg text-sm font-medium text-zinc-900 hover:bg-zinc-100 transition-colors"
          style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '12px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto mt-6">
        {loading ? (
          <div className="p-4 text-center text-zinc-500 text-sm">Loading files...</div>
        ) : fileTree ? (
          renderNode(fileTree)
        ) : (
          <div className="p-4 text-center text-zinc-500 text-sm">No files found</div>
        )}
      </div>
    </div>
  );
}
