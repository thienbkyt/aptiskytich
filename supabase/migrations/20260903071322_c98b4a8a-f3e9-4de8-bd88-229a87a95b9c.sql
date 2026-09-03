ALTER TABLE public.user_goals DROP CONSTRAINT IF EXISTS user_goals_aim_check;
UPDATE public.user_goals SET aim = 'C1' WHERE aim = 'C';
ALTER TABLE public.user_goals ADD CONSTRAINT user_goals_aim_check CHECK (aim = ANY (ARRAY['B1'::text, 'B2'::text, 'C1'::text]));