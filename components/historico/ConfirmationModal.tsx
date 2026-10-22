import React from 'react';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';
import { AlertTriangleIcon } from '../../lib/icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    description, 
    confirmText = 'Confirmar Exclusão', 
    isLoading = false 
}) => {
  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose} displayMode="dialog">
      <ResponsiveModalContent className="max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangleIcon className="h-6 w-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <div className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
              {description}
            </div>
          </div>
        </div>
        
        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900/90 flex justify-end gap-2.5">
          <Button 
            type="button"
            variant="outline" 
            onClick={onClose} 
            disabled={isLoading} 
            className="text-xs h-9 px-4 border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            Cancelar
          </Button>
          <Button 
            type="button"
            className="text-xs h-9 px-5 bg-red-600 hover:bg-red-500 font-semibold text-white shadow-sm shadow-red-600/30 border-none" 
            onClick={onConfirm} 
            isLoading={isLoading}
            loadingText="Excluindo..."
          >
            {confirmText}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ConfirmationModal;
