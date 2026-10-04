-- Remove the unused Firebase identity bridge after reverting Firebase sign-in.
DROP TABLE IF EXISTS public.firebase_auth_links;
