import React, { useEffect } from 'react';
import { CheckCircleIcon, XIcon } from '../../lib/icons';

interface SuccessPopupProps {
  message: string;
  onClose: () => void;
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 15000); // Auto-close after 15 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col bg-brand-dark-900/90 backdrop-blur-md text-white border border-green-500/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in-0 slide-in-from-bottom-8 duration-500 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 pr-12 relative">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
        </div>
        <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">Sucesso</span>
            <span className="text-xs text-gray-400 font-medium">{message}</span>
        </div>
        <button 
          onClick={onClose}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          title="Fechar"
        >
            <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="h-1 bg-green-500/20 w-full">
        <div className="h-full bg-green-500 animate-progress-shrink origin-left" />
      </div>
      <style>{`
        @keyframes progress-shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .animate-progress-shrink {
          animation: progress-shrink 15000ms linear forwards;
        }
      `}</style>
    </div>
  );
};

export default SuccessPopup;