-- Primary color the user picked on their profile (constants/theme-colors.ts); NULL = default brand color.
ALTER TABLE "users" ADD COLUMN "theme_color" TEXT;
