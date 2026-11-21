-- Production history 20261119010923. Reaffirms an ALREADY EXISTING
-- column-level privilege. Pre-migration has_column_privilege returned true.
-- This is not evidence of a functional notifications defect being fixed.
-- Existing RLS enforces ownership on UPDATE; no rows changed.
GRANT UPDATE (read_at) ON TABLE public.v31_notifications TO authenticated;
