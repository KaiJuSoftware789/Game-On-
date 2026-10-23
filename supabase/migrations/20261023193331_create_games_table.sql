CREATE TABLE public.games (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'PC'
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view games" ON public.games FOR
SELECT USING (true);
INSERT INTO public.games (name, platform)
VALUES ('Counter-Strike 2', 'PC'),
    ('VALORANT', 'PC'),
    ('League of Legends', 'PC'),
    ('Left 4 Dead 2', 'PC'),
    ('Minecraft', 'Cross-platform');