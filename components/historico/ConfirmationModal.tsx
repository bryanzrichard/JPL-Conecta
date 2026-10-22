import React from 'react';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter } from '../ui/ResponsiveModal';
import { Button } from '../ui/Button';

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
    confirmText = 'Confirmar', 
    isLoading = false 
}) => {
  return (
    <ResponsiveModal isOpen={isOpen} onOpenChange={onClose}>
      <ResponsiveModalContent className="max-w-md bg-brand-dark-950 border border-gray-800 p-0 overflow-hidden flex flex-col">
        <ResponsiveModalHeader className="px-5 py-4 border-b border-gray-800 bg-brand-dark-900 flex-shrink-0">
          <ResponsiveModalTitle className="text-base text-white">{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="hidden">Confirmação de ação</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        
        <div className="p-5 text-sm text-gray-400 bg-brand-dark-950/50">
          {description}
        </div>
        
        <ResponsiveModalFooter className="p-4 border-t border-gray-800 bg-brand-dark-900 flex-shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="text-sm h-9">Cancelar</Button>
          <Button 
            className="text-sm h-9 px-6 bg-red-600 hover:bg-red-500 font-medium text-white border-none" 
            onClick={onConfirm} 
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};

export default ConfirmationModal;