-- Migração Multi-Tenant para tabelas do N8N (Postgres)
-- Executar este script no banco de dados usado pelo N8N.

-- 1. Adicionar coluna tenant_id na fila de mensagens
ALTER TABLE IF EXISTS public.n8n_fila_mensagens 
ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Para registros antigos (opcional), você pode definir um tenant_id padrão
-- UPDATE public.n8n_fila_mensagens SET tenant_id = 'DEFAULT_TENANT' WHERE tenant_id IS NULL;

-- Tornar a coluna NOT NULL se for necessário (recomendado)
-- ALTER TABLE public.n8n_fila_mensagens ALTER COLUMN tenant_id SET NOT NULL;


-- 2. Recriar/Alterar a tabela de histórico de mensagens
-- A tabela original gerada pelo node langchain chat memory não tem tenant_id.
-- Como o node usa a propriedade sessionKey, a alteração que fizemos (tenant_id + telefone)
-- já resolve o isolamento. A tabela "chat_messages" não precisa de schema adicional 
-- porque a session_id já será única por tenant.

-- FIM DA MIGRAÇÃO
