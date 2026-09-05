ALTER TABLE "stills" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "stills" ADD CONSTRAINT "stills_content_hash_unique" UNIQUE("content_hash");