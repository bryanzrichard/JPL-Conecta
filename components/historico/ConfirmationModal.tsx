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
      <ResponsiveModalContent size="sm">
        <ResponsiveModalHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 shrink-0">
              <AlertTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
              <ResponsiveModalDescription>Confirmação de ação</ResponsiveModalDescription>
            </div>
          </div>
        </ResponsiveModalHeader>

        <div className="p-6 text-sm text-gray-300 leading-relaxed bg-brand-dark-950/50">
          {description}
        </div>
        
        <ResponsiveModalFooter>
          <Button 
            type="button"
            variant="ghost" 
            onClick={onClose} 
            disabled={isLoading} 
            className="text-gray-400 hover:text-white hover:bg-brand-dark-800"
          >
            Cancelar
          </Button>
          <Button 
            type="button"
            className="bg-red-600 hover:bg-red-500 font-semibold text-white shadow-sm shadow-red-600/30 border-none" 
            onClick={onConfirm} 
            isLoading={isLoading}
            loadingText="Processando..."
          >
            {confirmText}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ConfirmationModal;
