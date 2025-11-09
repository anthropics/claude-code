'use client';

import { useState, useEffect } from 'react';

interface UserPermissions {
  allowedTools: string[];
  deniedTools: string[];
  allowedDirectories: string[];
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
}

interface SettingsProps {
  token: string;
  currentUsername: string;
  onClose: () => void;
}

const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:3001`
    : 'http://localhost:3001';
};

const ALL_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Task',
  'TodoWrite',
];

const PERMISSION_MODES = [
  { value: 'default', label: 'Default (Ask for permission)', description: 'User will be prompted for tool usage' },
  { value: 'acceptEdits', label: 'Accept Edits', description: 'Automatically accept file edits' },
  { value: 'bypassPermissions', label: 'Bypass All', description: 'Skip all permission checks' },
];

export default function Settings({ token, currentUsername, onClose }: SettingsProps) {
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [permissions, setPermissions] = useState<UserPermissions>({
    allowedTools: [],
    deniedTools: [],
    allowedDirectories: [],
    permissionMode: 'default',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newDirectory, setNewDirectory] = useState('');

  // Only mike can access settings
  if (currentUsername !== 'mike') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
        <div className="rounded-2xl max-w-md shadow-lg" style={{ backgroundColor: 'rgb(250, 249, 245)', border: '1px solid rgba(31, 30, 29, 0.15)', padding: '32px' }}>
          <h2 className="text-xl font-semibold text-zinc-900" style={{ marginBottom: '12px' }}>Access Denied</h2>
          <p className="text-zinc-600" style={{ marginBottom: '24px' }}>Only administrators can access settings.</p>
          <button
            onClick={onClose}
            className="w-full rounded-lg text-zinc-900 font-medium hover:bg-zinc-100 transition-colors"
            style={{ border: '1px solid rgba(31, 30, 29, 0.15)', backgroundColor: 'rgb(255, 255, 255)', padding: '12px 16px' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadPermissions(selectedUser);
    }
  }, [selectedUser]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        if (data.users.length > 0 && !selectedUser) {
          setSelectedUser(data.users[0]);
        }
      }
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const loadPermissions = async (username: string) => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/admin/permissions/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data);
      }
    } catch (err) {
      setError('Failed to load permissions');
    }
  };

  const savePermissions = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${getBackendUrl()}/api/admin/permissions/${selectedUser}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(permissions)
      });

      if (response.ok) {
        setSuccess('Permissions saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error('Failed to save permissions');
      }
    } catch (err) {
      setError('Failed to save permissions');
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (tool: string, type: 'allowed' | 'denied') => {
    const list = type === 'allowed' ? permissions.allowedTools : permissions.deniedTools;
    const otherList = type === 'allowed' ? permissions.deniedTools : permissions.allowedTools;

    if (list.includes(tool)) {
      setPermissions({
        ...permissions,
        [type === 'allowed' ? 'allowedTools' : 'deniedTools']: list.filter(t => t !== tool)
      });
    } else {
      setPermissions({
        ...permissions,
        [type === 'allowed' ? 'allowedTools' : 'deniedTools']: [...list, tool],
        [type === 'allowed' ? 'deniedTools' : 'allowedTools']: otherList.filter(t => t !== tool)
      });
    }
  };

  const addDirectory = () => {
    if (newDirectory && !permissions.allowedDirectories.includes(newDirectory)) {
      setPermissions({
        ...permissions,
        allowedDirectories: [...permissions.allowedDirectories, newDirectory]
      });
      setNewDirectory('');
    }
  };

  const removeDirectory = (dir: string) => {
    setPermissions({
      ...permissions,
      allowedDirectories: permissions.allowedDirectories.filter(d => d !== dir)
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '24px' }}>
      <div className="rounded-2xl w-full overflow-hidden shadow-xl" style={{ backgroundColor: 'rgb(250, 249, 245)', border: '1px solid rgba(31, 30, 29, 0.15)', maxWidth: '900px', maxHeight: '85vh' }}>
        <div className="sticky top-0" style={{ backgroundColor: 'rgb(250, 249, 245)', borderBottom: '1px solid rgba(31, 30, 29, 0.15)', padding: '24px 32px' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-900">User Permissions</h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
              style={{ padding: '8px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)', padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-900" style={{ marginBottom: '12px' }}>
              Select User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg text-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-opacity-20"
              style={{
                border: '1px solid rgba(31, 30, 29, 0.15)',
                backgroundColor: 'rgb(255, 255, 255)',
                padding: '10px 16px',
                paddingRight: '40px',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px 20px'
              }}
            >
              {users.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Permission Mode */}
          <div>
            <label className="block text-sm font-medium text-zinc-900" style={{ marginBottom: '12px' }}>
              Permission Mode
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {PERMISSION_MODES.map(mode => (
                <label
                  key={mode.value}
                  className="flex items-start rounded-lg cursor-pointer transition-all"
                  style={{
                    border: '1px solid rgba(31, 30, 29, 0.15)',
                    backgroundColor: permissions.permissionMode === mode.value ? 'rgb(255, 255, 255)' : 'transparent',
                    padding: '16px',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (permissions.permissionMode !== mode.value) {
                      e.currentTarget.style.backgroundColor = 'rgb(255, 255, 255)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (permissions.permissionMode !== mode.value) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="permissionMode"
                    value={mode.value}
                    checked={permissions.permissionMode === mode.value}
                    onChange={(e) => setPermissions({ ...permissions, permissionMode: e.target.value as any })}
                    style={{ marginTop: '2px' }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900" style={{ marginBottom: '4px' }}>{mode.label}</div>
                    <div className="text-sm text-zinc-600">{mode.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Allowed Tools */}
          <div>
            <label className="block text-sm font-medium text-zinc-900" style={{ marginBottom: '12px' }}>
              Allowed Tools
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(max(150px, calc((100% - 36px) / 4)), 1fr))',
              gap: '12px'
            }}>
              {ALL_TOOLS.map(tool => (
                <label
                  key={tool}
                  className="flex items-center rounded-lg cursor-pointer transition-all"
                  style={{
                    border: '1px solid rgba(31, 30, 29, 0.15)',
                    backgroundColor: permissions.allowedTools.includes(tool) ? 'rgb(255, 255, 255)' : 'transparent',
                    padding: '12px 16px',
                    gap: '12px',
                    minWidth: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 255, 255)'}
                  onMouseLeave={(e) => {
                    if (!permissions.allowedTools.includes(tool)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={permissions.allowedTools.includes(tool)}
                    onChange={() => toggleTool(tool, 'allowed')}
                  />
                  <span className="text-sm text-zinc-900 font-medium select-none" style={{ whiteSpace: 'nowrap' }}>{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Denied Tools */}
          <div>
            <label className="block text-sm font-medium text-zinc-900" style={{ marginBottom: '12px' }}>
              Denied Tools
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(max(150px, calc((100% - 36px) / 4)), 1fr))',
              gap: '12px'
            }}>
              {ALL_TOOLS.map(tool => (
                <label
                  key={tool}
                  className="flex items-center rounded-lg cursor-pointer transition-all"
                  style={{
                    border: '1px solid rgba(31, 30, 29, 0.15)',
                    backgroundColor: permissions.deniedTools.includes(tool) ? 'rgb(255, 255, 255)' : 'transparent',
                    padding: '12px 16px',
                    gap: '12px',
                    minWidth: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(255, 255, 255)'}
                  onMouseLeave={(e) => {
                    if (!permissions.deniedTools.includes(tool)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={permissions.deniedTools.includes(tool)}
                    onChange={() => toggleTool(tool, 'denied')}
                  />
                  <span className="text-sm text-zinc-900 font-medium select-none" style={{ whiteSpace: 'nowrap' }}>{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Allowed Directories */}
          <div>
            <label className="block text-sm font-medium text-zinc-900" style={{ marginBottom: '12px' }}>
              Allowed Directories
            </label>
            <div className="flex" style={{ gap: '12px', marginBottom: '12px' }}>
              <input
                type="text"
                value={newDirectory}
                onChange={(e) => setNewDirectory(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDirectory()}
                placeholder="/path/to/directory"
                className="flex-1 rounded-lg text-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-opacity-20"
                style={{
                  border: '1px solid rgba(31, 30, 29, 0.15)',
                  backgroundColor: 'rgb(255, 255, 255)',
                  padding: '10px 16px'
                }}
              />
              <button
                onClick={addDirectory}
                className="rounded-lg text-zinc-900 font-medium hover:bg-zinc-100 transition-colors"
                style={{ border: '1px solid rgba(31, 30, 29, 0.15)', backgroundColor: 'rgb(255, 255, 255)', padding: '10px 20px' }}
              >
                Add
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {permissions.allowedDirectories.map(dir => (
                <div
                  key={dir}
                  className="flex items-center justify-between rounded-lg"
                  style={{ border: '1px solid rgba(31, 30, 29, 0.15)', backgroundColor: 'rgb(255, 255, 255)', padding: '12px 16px' }}
                >
                  <span className="text-sm text-zinc-900 font-mono">{dir}</span>
                  <button
                    onClick={() => removeDirectory(dir)}
                    className="text-sm font-medium transition-colors rounded-md hover:bg-red-50"
                    style={{ color: 'rgb(220, 38, 38)', padding: '6px 12px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {permissions.allowedDirectories.length === 0 && (
                <p className="text-sm text-zinc-500 italic" style={{ padding: '8px 0' }}>No directory restrictions</p>
              )}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-lg text-sm font-medium" style={{ backgroundColor: 'rgb(254, 242, 242)', border: '1px solid rgb(252, 165, 165)', color: 'rgb(220, 38, 38)', padding: '16px' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg text-sm font-medium" style={{ backgroundColor: 'rgb(240, 253, 244)', border: '1px solid rgb(134, 239, 172)', color: 'rgb(34, 197, 94)', padding: '16px' }}>
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex" style={{ gap: '12px', paddingTop: '8px' }}>
            <button
              onClick={savePermissions}
              disabled={loading}
              className="flex-1 rounded-lg text-zinc-900 font-semibold hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ border: '1px solid rgba(31, 30, 29, 0.15)', backgroundColor: 'rgb(255, 255, 255)', padding: '14px 16px' }}
            >
              {loading ? 'Saving...' : 'Save Permissions'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg text-zinc-700 font-semibold hover:bg-zinc-100 transition-colors"
              style={{ border: '1px solid rgba(31, 30, 29, 0.15)', padding: '14px 32px' }}
            >
              Cancel
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
