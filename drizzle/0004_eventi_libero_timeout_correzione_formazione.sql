ALTER TYPE "public"."event_kind" ADD VALUE 'libero' BEFORE 'rotation';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'timeout' BEFORE 'set_end';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'correction' BEFORE 'set_end';--> statement-breakpoint
ALTER TYPE "public"."event_kind" ADD VALUE 'lineup' BEFORE 'set_end';