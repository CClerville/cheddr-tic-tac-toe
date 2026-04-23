ALTER TABLE "games" ADD CONSTRAINT "games_difficulty_check" CHECK ("difficulty" IN ('beginner', 'intermediate', 'expert')) NOT VALID;--> statement-breakpoint
ALTER TABLE "games" VALIDATE CONSTRAINT "games_difficulty_check";--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_result_check" CHECK ("result" IN ('win', 'loss', 'draw')) NOT VALID;--> statement-breakpoint
ALTER TABLE "games" VALIDATE CONSTRAINT "games_result_check";--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_personality_check" CHECK ("personality" IS NULL OR "personality" IN ('trash_talk', 'coach', 'zen_master', 'sports_caster')) NOT VALID;--> statement-breakpoint
ALTER TABLE "games" VALIDATE CONSTRAINT "games_personality_check";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kind_check" CHECK ("kind" IN ('anon', 'clerk')) NOT VALID;--> statement-breakpoint
ALTER TABLE "users" VALIDATE CONSTRAINT "users_kind_check";
