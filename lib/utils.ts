
import { supabase } from './supabaseClient';

// Helper to format BRL currency consistently across the app
export const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
};

// Helper to format dates in pt-BR without UTC timezone off-by-one shifts
export const formatDateBR = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return 'N/A';
    if (dateString instanceof Date) {
        return isNaN(dateString.getTime()) ? 'N/A' : dateString.toLocaleDateString('pt-BR');
    }
    const cleanDate = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const date = new Date(`${cleanDate}T00:00:00`);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR');
};

// Helper to format dates as YYYY-MM-DD in local timezone (never using toISOString)
export const formatDateYMD = (dateInput: Date | string): string => {
    if (typeof dateInput === 'string') {
        const clean = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
        const parsed = new Date(`${clean}T00:00:00`);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return clean;
    }
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Helper to normalize 14-digit CNPJ strings into XX.XXX.XXX/XXXX-XX
export const formatCnpj = (value?: string | null): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length !== 14) return value;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// Centralized helper to open Supabase Storage attachments safely without leaving orphan blank tabs
export const openStorageFile = async (
    path: string,
    bucket: string = 'jpl-conecta'
): Promise<void> => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write('Carregando documento...');
    }

    try {
        if (path.startsWith('http')) {
            if (newWindow) {
                newWindow.location.href = path;
            } else {
                window.location.href = path;
            }
            return;
        }

        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 60);

        if (error) throw error;

        if (data?.signedUrl) {
            if (newWindow) {
                newWindow.location.href = data.signedUrl;
            } else {
                window.location.href = data.signedUrl;
            }
        } else {
            if (newWindow) newWindow.close();
            throw new Error('Link temporário não pôde ser gerado.');
        }
    } catch (err) {
        if (newWindow) newWindow.close();
        throw err;
    }
};

// Function to compute SHA-256 hash of a file
export const computeSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

// Function to enhance document images (like A4 paper photos) for better OCR
export const enhanceDocumentImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(file); // Fallback to original if canvas fails
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Apply filters to simulate a "document scanner"
            // Grayscale removes color noise, contrast makes text darker/paper whiter
            ctx.filter = 'grayscale(100%) contrast(1.4) brightness(1.1)';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const enhancedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_enhanced.jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(enhancedFile);
                    } else {
                        resolve(file); // Fallback
                    }
                },
                'image/jpeg',
                0.90 // High quality, size will be managed by browser-image-compression later
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fallback to original on error
        };

        img.src = url;
    });
};
