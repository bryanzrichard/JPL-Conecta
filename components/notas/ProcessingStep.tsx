import React, { useState, useEffect } from 'react';
import { AIProcessJob } from '../../types';
import { Button } from '../ui/Button';
import { CheckCircleIcon, CircleIcon } from '../../lib/icons';

// A more polished animated checkmark
const AnimatedCheck = () => (
    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="3"/>
        <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke="currentColor" strokeWidth="4"/>
        <style>{`
            .checkmark__circle {
                stroke-dasharray: 166;
                stroke-dashoffset: 166;
                animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
            }
            .checkmark__check {
                transform-origin: 50% 50%;
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
            }
            @keyframes stroke {
                100% { stroke-dashoffset: 0; }
            }
        `}</style>
    </svg>
);


const LoaderIcon = () => (
    <div className="h-5 w-5">
        <svg width="24" height="24" viewBox="0 0 24" xmlns="http://www.w3.org/2000/svg" className="text-brand-blue-500 h-5 w-5">
            <style>{`.spinner_V8m1{transform-origin:center;animation:spinner_zKoa 2s linear infinite}.spinner_V8m1 circle{stroke-linecap:round;animation:spinner_YpZS 1.5s ease-in-out infinite}}@keyframes spinner_zKoa{100%{transform:rotate(360deg)}}@keyframes spinner_YpZS{0%{stroke-dasharray:0 150;stroke-dashoffset:0}47.5%{stroke-dasharray:42 150;stroke-dashoffset:-16}95%,100%{stroke-dasharray:42 150;stroke-dashoffset:-59}}`}</style>
            <g className="spinner_V8m1"><circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3"></circle></g>
        </svg>
    </div>
);

const processingSteps = [
    'Arquivo enviado com sucesso!',
    'Lendo o documento...',
    'Extraindo dados da nota...',
    'Verificando fornecedor...',
    'Análise concluída!',
];

const verificationSteps = [
    'Analisando documento...',
    'Extraindo dados essenciais...',
    'Verificando duplicidade no sistema...',
    'Validação concluída!',
];

interface ProcessingStepProps {
    job: AIProcessJob | null;
    error: string | null;
    onRetry: () => void;
    verificationMode?: boolean;
}

const ProcessingStep: React.FC<ProcessingStepProps> = ({ job, error, onRetry, verificationMode = false }) => {
    const steps = verificationMode ? verificationSteps : processingSteps;
    const [currentStep, setCurrentStep] = useState(0);
    const finalStep = steps.length -1;

    useEffect(() => {
        if (error || job?.status === 'completed' || job?.status === 'failed') {
            return; // Stop simulation
        }

        if (currentStep < finalStep) {
            const isFirstStep = currentStep === 0;
            const delay = verificationMode ? 1000 : (isFirstStep ? 500 : 1500 + Math.random() * 1000);
            const timer = setTimeout(() => {
                setCurrentStep(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [currentStep, error, job, finalStep, verificationMode]);
    
    useEffect(() => {
        if (job?.status === 'completed') {
            setCurrentStep(finalStep);
        }
    }, [job?.status, finalStep]);

    if (error) {
        const isMissingDataError = error.includes("essential data") || error.includes("A IA não conseguiu identificar o CNPJ");
        const displayTitle = isMissingDataError ? "Dados Essenciais Ausentes" : "Falha no Processamento";
        const displaySubtitle = isMissingDataError 
            ? "A nota não pôde ser processada automaticamente." 
            : "Não foi possível analisar o documento.";
        const displayError = isMissingDataError 
            ? "A Inteligência Artificial não conseguiu identificar o CNPJ do fornecedor ou o número da nota. Verifique se a imagem está nítida, sem cortes e se o documento é realmente uma nota fiscal válida."
            : error;

        return (
             <div className="flex h-full flex-col items-center justify-center text-center p-6 animate-in fade-in">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-white mb-2">{displayTitle}</h3>
                <p className="text-gray-400 max-w-sm">{displaySubtitle}</p>
                <div className="text-red-400 text-sm mt-4 max-w-sm text-left bg-red-900/20 p-4 rounded-xl border border-red-500/20">
                    <p className="font-semibold mb-1">Motivo:</p>
                    <p className="leading-relaxed">{displayError}</p>
                </div>
                <Button onClick={onRetry} className="mt-6">Tentar Novamente</Button>
            </div>
        );
    }
    
    const getStepStatus = (stepIndex: number) => {
        if (verificationMode && stepIndex === finalStep) return 'active';
        if (job?.status === 'completed' && stepIndex === finalStep) return 'completed';
        if (stepIndex < currentStep) return 'completed';
        if (stepIndex === currentStep && currentStep !== finalStep) return 'active';
        if (stepIndex === finalStep && currentStep === finalStep) return 'completed';
        return 'pending';
    };

    return (
        <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-blue-500/10 mb-4">
                        <LoaderIcon />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight uppercase">Processando Documento</h3>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-mono">IA Engine v2.5</p>
                </div>

                <div className="space-y-4 relative">
                    {/* Vertical line connecting steps */}
                    <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-800 z-0" />

                    {steps.map((step, index) => {
                        const status = getStepStatus(index);
                        const isCompleted = status === 'completed';
                        const isActive = status === 'active';

                        return (
                            <div key={index} className="flex items-center gap-4 transition-all duration-500 relative z-10" style={{ opacity: isActive || isCompleted ? 1 : 0.3 }}>
                                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-brand-dark-900 rounded-full">
                                    {isCompleted ? <AnimatedCheck /> :
                                     isActive ? <LoaderIcon /> :
                                     <div className="w-2 h-2 rounded-full bg-gray-700" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-mono text-gray-600 uppercase tracking-tighter">Passo {index + 1}</span>
                                    <p className={`text-sm ${isCompleted ? 'text-green-400 font-medium' : isActive ? 'text-white font-bold' : 'text-gray-500'}`}>
                                        {step}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ProcessingStep;