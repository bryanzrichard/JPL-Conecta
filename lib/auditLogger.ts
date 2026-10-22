import { supabase } from './supabaseClient';
import { Json } from '../types';

export const logAuditAction = async (
    company_id: string | undefined,
    user_email: string | null | undefined,
    action: string,
    resource: string,
    details?: Json
) => {
    if (!company_id) return;
    
    try {
        await supabase.from('audit_logs').insert({
            company_id,
            user_email: user_email || 'Sistema',
            action,
            resource,
            details: details || null,
        });
    } catch (e) {
        // Silently fail if table doesn't exist
        console.error('Audit log failed:', e);
    }
};
