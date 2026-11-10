-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "user_clients_client_id_idx" ON "user_clients"("client_id");

-- CreateIndex
CREATE INDEX "filters_tbc_id_idx" ON "filters"("tbc_id");

-- CreateIndex
CREATE INDEX "backup_runs_executed_by_user_id_idx" ON "backup_runs"("executed_by_user_id");

-- CreateIndex
CREATE INDEX "backups_tbc_id_idx" ON "backups"("tbc_id");

-- CreateIndex
CREATE INDEX "backups_restored_to_tbc_id_idx" ON "backups"("restored_to_tbc_id");

-- CreateIndex
CREATE INDEX "backups_sentence_category_id_idx" ON "backups"("sentence_category_id");

-- CreateIndex
CREATE INDEX "ficha_automation_runs_organization_id_started_at_idx" ON "ficha_automation_runs"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "ficha_automation_steps_run_id_idx" ON "ficha_automation_steps"("run_id");

-- CreateIndex
CREATE INDEX "sentences_sentence_categories_id_idx" ON "sentences"("sentence_categories_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "soap_logs_user_id_idx" ON "soap_logs"("user_id");

-- CreateIndex
CREATE INDEX "soap_logs_organization_id_status_created_at_idx" ON "soap_logs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "email_logs_user_id_idx" ON "email_logs"("user_id");

-- CreateIndex
CREATE INDEX "api_logs_user_id_idx" ON "api_logs"("user_id");

-- CreateIndex
CREATE INDEX "soap_templates_organization_id_idx" ON "soap_templates"("organization_id");

-- CreateIndex
CREATE INDEX "soap_favorites_organization_id_user_id_idx" ON "soap_favorites"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "analysts_organization_id_deleted_at_idx" ON "analysts"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "requesters_organization_id_deleted_at_idx" ON "requesters"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "departments_organization_id_deleted_at_idx" ON "departments"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "demand_types_organization_id_deleted_at_idx" ON "demand_types"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "attachments_demand_id_idx" ON "attachments"("demand_id");

-- CreateIndex
CREATE INDEX "comments_demand_id_idx" ON "comments"("demand_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "mapeador_projetos_organization_id_deleted_at_idx" ON "mapeador_projetos"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "mapeador_etapas_projeto_id_idx" ON "mapeador_etapas"("projeto_id");

-- CreateIndex
CREATE INDEX "mapeador_temas_organization_id_idx" ON "mapeador_temas"("organization_id");

-- CreateIndex
CREATE INDEX "mapeador_templates_projeto_organization_id_idx" ON "mapeador_templates_projeto"("organization_id");

