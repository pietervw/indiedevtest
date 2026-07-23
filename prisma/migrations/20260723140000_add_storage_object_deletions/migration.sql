-- CreateTable
CREATE TABLE "storage_object_deletions" (
    "id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_object_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_object_deletions_object_key_key" ON "storage_object_deletions"("object_key");

-- CreateIndex
CREATE INDEX "storage_object_deletions_next_attempt_at_idx" ON "storage_object_deletions"("next_attempt_at");
