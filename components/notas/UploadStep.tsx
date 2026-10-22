
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloudIcon } from '../../lib/icons';

interface UploadStepProps {
    onFileSelect: (file: File) => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ onFileSelect }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
        },
        maxFiles: 1,
        multiple: false,
    } as any);

    return (
        <div className="h-full flex items-center justify-center p-6">
            <div 
                {...getRootProps()}
                className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 w-full max-w-md
                ${isDragActive ? 'border-brand-blue-500 bg-brand-blue-500/10' : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'}`}
            >
                <input {...getInputProps()} />
                <UploadCloudIcon className={`h-12 w-12 mb-4 transition-colors ${isDragActive ? 'text-brand-blue-500' : 'text-gray-500'}`} />
                <p className="font-semibold text-white">
                    {isDragActive ? 'Solte o arquivo aqui!' : 'Arraste e solte o arquivo aqui'}
                </p>
                <p className="text-sm text-gray-400">ou clique para selecionar</p>
                <p className="text-xs text-gray-500 mt-4">Suporta PDF, JPG, PNG (máx. 1 arquivo)</p>
            </div>
        </div>
    );
};

export default UploadStep;