import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { Toast as ToastType, ToastType as ToastVariant } from '../../types';
import { cn } from '../../utils';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const toastStyles: Record<ToastVariant, { bg: string; icon: React.ReactNode; border: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: <CheckCircle className="text-green-500" size={20} />,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: <AlertCircle className="text-red-500" size={20} />,
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: <AlertTriangle className="text-yellow-600" size={20} />,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Info className="text-blue-500" size={20} />,
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const style = toastStyles[toast.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-lg',
        'animate-slide-up backdrop-blur-sm',
        style.bg,
        style.border
      )}
    >
      {style.icon}
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-black/5 rounded-lg transition-colors"
        aria-label="Закрыть уведомление"
      >
        <X size={16} className="text-gray-400" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
      aria-label="Уведомления"
    >
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
