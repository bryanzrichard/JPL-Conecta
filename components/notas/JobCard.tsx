import React from 'react';
import { AIProcessJob } from '../../types';
import { Button } from '../ui/Button';
import { CheckCircleIcon, Trash2Icon, ClockIcon, EditIcon, XIcon } from '../../lib/icons';

// Loader Icon (Small)
const LoaderIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-brand-blue-500 animate-spin">
        <style>{`.spinner_V8m1{transform-origin:center;animation:spinner_zKoa 2s linear infinite}.spinner_V8m1 circle{stroke-linecap:round;animation:spinner_YpZS 1.5s ease-in-out infinite}}@keyframes spinner_zKoa{100%{transform:rotate(360deg)}}@keyframes spinner_YpZS{0%{stroke-dasharray:0 150;stroke-dashoffset:0}47.5%{stroke-dasharray:42 150;stroke-dashoffset:-16}95%,100%{stroke-dasharray:42 150;stroke-dashoffset:-59}}`}</style>
        <g className="spinner_V8m1"><circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3"></circle></g>
    </svg>
);

interface JobCardProps {
  job: AIProcessJob;
  onSelect: (job: AIProcessJob) => void;
  onArchiveOrCancel: (job: AIProcessJob) => void;
  customText?: string;
}

const JobCard: React.FC<JobCardProps> = ({ job, onSelect, onArchiveOrCancel, customText }) => {
  const fileName = job.storage_path.split('/').pop() || 'Arquivo desconhecido';

  const statusConfig = {
      pending: {
          icon: <ClockIcon className="h-4 w-4 text-yellow-500" />,
          text: "Na fila",
          textClass: "text-yellow-500",
          bgClass: "bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10",
          actions: (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20 rounded-lg" 
                onClick={() => onArchiveOrCancel(job)}
                title="Cancelar processamento"
              >
                  <XIcon className="h-4 w-4" />
              </Button>
          )
      },
      processing: {
          icon: <LoaderIcon />,
          text: "Processando...",
          textClass: "text-brand-blue-400",
          bgClass: "bg-brand-blue-500/5 border-brand-blue-500/20 hover:bg-brand-blue-500/10",
          actions: (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg" 
                onClick={() => onArchiveOrCancel(job)}
                title="Cancelar processamento"
              >
                  <XIcon className="h-3 w-3 mr-1.5" /> Cancelar
              </Button>
          )
      },
      completed: {
          icon: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
          text: "Pronto",
          textClass: "text-green-500",
          bgClass: "bg-green-500/5 border-green-500/20 hover:bg-green-500/10",
          actions: (
              <div className="flex items-center gap-2">
                  <Button
                      size="sm"
                      className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-0 rounded-lg"
                      onClick={() => onSelect(job)}
                  >
                      <EditIcon className="h-3 w-3 mr-1.5" /> Revisar
                  </Button>
                  <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-gray-700 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors rounded-lg"
                      onClick={() => onArchiveOrCancel(job)}
                      title="Descartar nota"
                  >
                      <Trash2Icon className="h-4 w-4" />
                  </Button>
              </div>
          )
      },
      failed: {
          icon: <Trash2Icon className="h-4 w-4 text-red-500" />,
          text: "Falhou",
          textClass: "text-red-500",
          bgClass: "bg-red-500/5 border-red-500/20 hover:bg-red-500/10",
          actions: (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg" 
                onClick={() => onArchiveOrCancel(job)}
              >
                  Remover
              </Button>
          )
      }
  };

  const config = statusConfig[job.status] || statusConfig.failed;
  const displayText = customText || config.text;

  // Format error message to be more user friendly if it's the missing data error
  let displayError = job.error_message;
  if (displayError && (displayError.includes("essential data") || displayError.includes("A IA não conseguiu identificar o CNPJ"))) {
      displayError = "CNPJ ou Número da Nota não encontrados na imagem.";
  }

  return (
    <div className={`flex flex-col p-3 rounded-xl border shadow-sm transition-all duration-200 group ${config.bgClass}`}>
      <div className="flex items-center justify-between">
        {/* Left: Icon and Name */}
        <div className="flex items-center gap-3 min-w-0 flex-grow mr-4">
          <div className="flex-shrink-0 mt-0.5">
              {config.icon}
          </div>
          <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate pr-2" title={fileName}>
                  {fileName}
              </p>
              <div className="flex items-center gap-2 md:hidden mt-0.5">
                  <span className={`text-[10px] font-medium ${config.textClass}`}>{displayText}</span>
              </div>
          </div>
        </div>

        {/* Middle: Status Text (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:block flex-shrink-0 mr-6">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-black/20 ${config.textClass}`}>
                {displayText}
            </span>
        </div>

        {/* Right: Actions */}
        <div className="flex-shrink-0">
          {config.actions}
        </div>
      </div>
      
      {/* Error Message Display */}
      {job.status === 'failed' && displayError && (
          <div className="mt-3 text-xs text-red-400 bg-red-900/10 p-2 rounded-lg border border-red-500/10">
              <span className="font-semibold">Motivo:</span> {displayError}
          </div>
      )}
    </div>
  );
};

export default JobCard;