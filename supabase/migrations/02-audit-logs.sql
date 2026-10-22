-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy to view logs based on company
CREATE POLICY "Users can view audit logs for their company"
ON public.audit_logs
FOR SELECT
USING (company_id = (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid()));

-- Policy to insert logs
CREATE POLICY "Users can insert audit logs for their company"
ON public.audit_logs
FOR INSERT
WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND user_email = COALESCE(auth.jwt() ->> 'email', user_email)
);
