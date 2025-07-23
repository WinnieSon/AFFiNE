-- AlterTable
ALTER TABLE "user_identifications" ADD COLUMN     "image_data" TEXT,
ADD COLUMN     "image_type" VARCHAR DEFAULT 'image/jpeg',
ADD COLUMN     "speaker_id" VARCHAR,
ALTER COLUMN "images_data" DROP NOT NULL,
ALTER COLUMN "images_data" SET DATA TYPE JSON;
