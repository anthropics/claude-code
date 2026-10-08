import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Monitor, Smartphone, Laptop, Globe, Shield,
  XCircle, Clock, Plus, ArrowLeft, RefreshCw
} from 'lucide-react';
import {
  isAdmin, adminGetUsers, adminGetUserSessions,
  adminGetUserDevices, adminRevokeSession, adminRegisterUser,
  AuthUser, SessionInfo, DeviceInfo,
} from '../services/authService';
import { Button } from '../components/UI/Button';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'inspector' as 'inspector' | 'admin' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [navigate]);

  const loadUsers = async () => {
    setLoading(true);
    const u = await adminGetUsers();
    setUsers(u);
    setLoading(false);
  };

  const loadUserDetails = async (userId: string) => {
    setSelectedUser(userId);
    const [s, d] = await Promise.all([
      adminGetUserSessions(userId),
      adminGetUserDevices(userId),
    ]);
    setSessions(s);
    setDevices(d);
  };

  const handleRevoke = async (sessionId: string) => {
    await adminRevokeSession(sessionId);
    if (selectedUser) loadUserDetails(selectedUser);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await adminRegisterUser(newUser.email, newUser.password, newUser.name, newUser.role);
    if ('error' in result) {
      alert(result.error);
    } else {
      setShowRegister(false);
      setNewUser({ email: '', password: '', name: '', role: 'inspector' });
      loadUsers();
    }
  };

  const getDeviceIcon = (platform: string) => {
    if (platform === 'android' || platform === 'ios') return <Smartphone size={14} />;
    if (platform === 'web') return <Globe size={14} />;
    return <Laptop size={14} />;
  };

  const selectedUserData = users.find(u => u.id === selectedUser);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={18} />
        </button>
        <Shield size={20} className="text-blue-600" />
        <h1 className="text-lg font-bold text-gray-900">Yllapito</h1>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={loadUsers}>
          Paivita
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Users list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900">Kayttajat ({users.length})</h2>
            </div>
            <Button size="xs" variant="primary" icon={<Plus size={12} />} onClick={() => setShowRegister(!showRegister)}>
              Lisaa
            </Button>
          </div>

          {/* Register form */}
          {showRegister && (
            <form onSubmit={handleRegister} className="p-4 bg-blue-50 border-b border-blue-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nimi"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="email"
                  placeholder="Sahkoposti"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
                <input
                  type="password"
                  placeholder="Salasana"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value as 'inspector' | 'admin' })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="inspector">Tarkastaja</option>
                  <option value="admin">Yllapitaja</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="xs" type="submit" variant="primary">Rekisteroi</Button>
                <Button size="xs" variant="ghost" onClick={() => setShowRegister(false)}>Peruuta</Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Ladataan...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => loadUserDetails(user.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedUser === user.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    user.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : 'Tarkastaja'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected user details */}
        {selectedUserData && (
          <>
            {/* Sessions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Monitor size={16} className="text-gray-500" />
                <h3 className="font-semibold text-gray-900">
                  Aktiiviset sessiot: {selectedUserData.name}
                </h3>
              </div>

              <div className="divide-y divide-gray-100">
                {sessions.filter(s => s.active).length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">Ei aktiivisia sessioita</div>
                ) : (
                  sessions.filter(s => s.active).map(session => (
                    <div key={session.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="text-gray-400">
                        {getDeviceIcon(session.device?.platform || 'web')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {session.device?.deviceName || 'Tuntematon laite'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock size={10} />
                          <span>Viimeksi: {new Date(session.lastActivity).toLocaleString('fi-FI')}</span>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={<XCircle size={12} className="text-red-500" />}
                        onClick={() => handleRevoke(session.id)}
                      >
                        Katkaise
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Devices */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Smartphone size={16} className="text-gray-500" />
                <h3 className="font-semibold text-gray-900">
                  Rekisteroidyt laitteet: {selectedUserData.name}
                </h3>
              </div>

              <div className="divide-y divide-gray-100">
                {devices.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">Ei rekisteroityja laitteita</div>
                ) : (
                  devices.map(device => (
                    <div key={device.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="text-gray-400">
                        {getDeviceIcon(device.platform)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{device.deviceName}</p>
                        <p className="text-xs text-gray-500">
                          Alusta: {device.platform} | Ensimmainen kirjautuminen: {new Date(device.firstSeen).toLocaleDateString('fi-FI')}
                        </p>
                        <p className="text-xs text-gray-400">
                          Viimeisin: {new Date(device.lastSeen).toLocaleString('fi-FI')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
