import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from '../../utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const variantStyles = {
  danger: {
    icon: <AlertCircle className="text-red-500" size={48} />,
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    iconBg: 'bg-red-100',
  },
  warning: {
    icon: <AlertTriangle className="text-yellow-600" size={48} />,
    button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    iconBg: 'bg-yellow-100',
  },
  info: {
    icon: <Info className="text-blue-500" size={48} />,
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    iconBg: 'bg-blue-100',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'info',
}) => {
  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <div className="p-6 text-center">
        <div className={cn('inline-flex p-4 rounded-full mb-4', style.iconBg)}>
          {style.icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'flex-1 py-3 px-4 text-white rounded-xl font-bold transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              style.button
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
