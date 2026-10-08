BEGIN;
CREATE TABLE public.folkly_content_objects (
 article_version_id TEXT PRIMARY KEY REFERENCES public.folkly_article_versions(id),
 pathname TEXT NOT NULL,
 sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 200000),
 verified_at TIMESTAMPTZ NOT NULL,
 CHECK (pathname = 'editorial/versions/' || sha256 || '.json')
);
ALTER TABLE public.folkly_content_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_content_objects FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.folkly_content_objects TO service_role;
COMMIT;
