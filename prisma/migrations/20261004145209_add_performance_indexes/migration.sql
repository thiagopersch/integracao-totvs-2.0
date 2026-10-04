-- CreateIndex
CREATE INDEX "api_logs_organization_id_created_at_idx" ON "api_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "backup_runs_filter_id_started_at_idx" ON "backup_runs"("filter_id", "started_at");

-- CreateIndex
CREATE INDEX "backups_filter_id_is_latest_code_sentence_idx" ON "backups"("filter_id", "is_latest", "code_sentence");

-- CreateIndex
CREATE INDEX "backups_backup_run_id_idx" ON "backups"("backup_run_id");

-- CreateIndex
CREATE INDEX "client_contracts_client_id_status_idx" ON "client_contracts"("client_id", "status");

-- CreateIndex
CREATE INDEX "demand_tags_tag_id_idx" ON "demand_tags"("tag_id");

-- CreateIndex
CREATE INDEX "demands_organization_id_deleted_at_date_idx" ON "demands"("organization_id", "deleted_at", "date");

-- CreateIndex
CREATE INDEX "demands_client_id_idx" ON "demands"("client_id");

-- CreateIndex
CREATE INDEX "demands_analyst_id_idx" ON "demands"("analyst_id");

-- CreateIndex
CREATE INDEX "email_logs_organization_id_created_at_idx" ON "email_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "filters_next_run_at_idx" ON "filters"("next_run_at");

-- CreateIndex
CREATE INDEX "filters_organization_id_client_id_idx" ON "filters"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "soap_logs_organization_id_created_at_idx" ON "soap_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "tbcs_client_id_idx" ON "tbcs"("client_id");
