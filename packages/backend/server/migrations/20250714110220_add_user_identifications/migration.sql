-- CreateTable
CREATE TABLE "user_identifications" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "user_id" VARCHAR,
    "nickname" VARCHAR,
    "title" VARCHAR,
    "email" VARCHAR,
    "image_data" TEXT NOT NULL,
    "image_type" VARCHAR NOT NULL DEFAULT 'image/jpeg',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" VARCHAR,

    CONSTRAINT "user_identifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_identifications_workspace_id_idx" ON "user_identifications"("workspace_id");

-- CreateIndex
CREATE INDEX "user_identifications_user_id_idx" ON "user_identifications"("user_id");

-- AddForeignKey
ALTER TABLE "user_identifications" ADD CONSTRAINT "user_identifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identifications" ADD CONSTRAINT "user_identifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
