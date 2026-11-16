-- Reading progress ("continue reading") for novels and manga.
-- One row per user per content item: the last chapter read + scroll position.
-- Written by ChapterScreen / MangaChapterScreen, read by Home/library/detail screens.

CREATE TABLE IF NOT EXISTS public.reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('novel', 'manga')),
    content_id UUID NOT NULL,
    chapter_key TEXT NOT NULL,          -- novel: chaptertitles key; manga: manga_chapters.id
    chapter_number INTEGER,             -- display number when available
    scroll_pct NUMERIC(6,2) NOT NULL DEFAULT 0,  -- 0-100 through the chapter
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON public.reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_recent ON public.reading_progress(user_id, updated_at DESC);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reading_progress: own rows" ON public.reading_progress;
CREATE POLICY "reading_progress: own rows" ON public.reading_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
