import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, LayoutDashboard, FileText, Settings, Menu, X, Shield, LogOut, Brain } from 'lucide-react';
import { useState } from 'react';
import { isAdmin, getUser, logout } from '../../services/authService';
import { getCorrectionStats } from '../../services/learningStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getUser();
  const stats = getCorrectionStats();

  const navItems = [
    { to: '/', label: 'Kojelauta', icon: LayoutDashboard },
    { to: '/reports', label: 'Raportit', icon: FileText },
    ...(isAdmin() ? [{ to: '/admin', label: 'Yllapito', icon: Shield }] : []),
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="bg-blue-600 text-white p-2 rounded-xl">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm leading-tight">KuntotarkastusAI</h1>
            <p className="text-xs text-gray-400 leading-tight">Ammattilaisten tyokalu</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive(to)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* AI Learning stats */}
        {stats.total > 0 && (
          <div className="mx-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-2 text-xs font-medium text-purple-700">
              <Brain size={14} />
              <span>AI oppiminen</span>
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {stats.total} korjausta tallennettu
            </p>
            {stats.unsynced > 0 && (
              <p className="text-xs text-purple-400 mt-0.5">
                {stats.unsynced} synkronoimatta
              </p>
            )}
          </div>
        )}

        {/* User info & logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 space-y-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                user.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
              }`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Kirjaudu ulos"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Settings size={12} />
            <span>v2.0.0 · AI Learning</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg"
            aria-label="Avaa valikko"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">KuntotarkastusAI</span>
          </div>
          <div className="flex-1" />
          {user && (
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
              title="Kirjaudu ulos"
            >
              <LogOut size={16} />
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};
