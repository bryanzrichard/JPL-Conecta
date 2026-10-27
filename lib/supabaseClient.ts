import { createClient } from '@supabase/supabase-js';
// FIX: The import path for `types` has been corrected to use the proper relative path.
import { Database } from '../types';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://bafceixyxskwivixhihp.supabase.co';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZmNlaXh5eHNrd2l2aXhoaWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTc2ODMsImV4cCI6MjA3ODI3MzY4M30.JZEqKE2NbPNDZoJ8l9wwrW4ukgLNYZNs7GVfI38f0A4';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);