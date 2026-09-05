CREATE TABLE "stills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL
);
