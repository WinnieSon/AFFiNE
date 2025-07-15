-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Add new column with default value
ALTER TABLE "user_identifications" ADD COLUMN "images_data" JSONB NOT NULL DEFAULT '[]';

-- Step 2: Migrate existing data from single image to images array
UPDATE "user_identifications" 
SET "images_data" = jsonb_build_array(
  jsonb_build_object(
    'data', "image_data",
    'type', "image_type"
  )
) 
WHERE "image_data" IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE "user_identifications" DROP COLUMN "image_data";
ALTER TABLE "user_identifications" DROP COLUMN "image_type";