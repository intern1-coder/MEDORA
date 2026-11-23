-- AlterTable: Add durable rotation lineage and authenticated token fields to refresh_tokens
ALTER TABLE "refresh_tokens" 
  ADD COLUMN "family_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "revoked_at" TIMESTAMPTZ,
  ADD COLUMN "replaced_by_token_id" UUID,


-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_token_id_key" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" 
  ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" 
  FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
