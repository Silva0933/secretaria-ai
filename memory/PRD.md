# ClinicaPanel v2.0 — PRD & Status

**Versão:** 2.0  
**Data:** Abril 2026  
**Status:** MVP completo — todas as fases implementadas

---

## Problema Original

Plataforma SaaS B2B multi-tenant para clínicas de saúde. Empacota secretária virtual (n8n + Evolution API + Gemini) como produto vendido a múltiplas clínicas. Cada clínica acessa seu painel isolado. Proprietário gerencia tudo via Super-Admin centralizado.

---

## Arquitetura Implementada

### Stack
- **Frontend:** React 18, Tailwind CSS, Lucide Icons, Recharts
- **Backend:** FastAPI (Python), Motor (MongoDB async)
- **Banco:** MongoDB (coleções prefixadas `cp_*`)
- **Auth:** JWT com tenant_id embutido + TOTP 2FA para super-admin
- **IA:** Google Gemini 2.5 Flash via emergentintegrations
- **Tempo Real:** WebSocket nativo (FastAPI)

### Coleções MongoDB
- `cp_tenants` — clínicas cadastradas
- `cp_tenant_config` — configurações por clínica
- `cp_profissionais` — profissionais por clínica
- `cp_operadores` — usuários/recepcionistas por clínica
- `cp_super_admins` — admins da plataforma
- `cp_kanban_cards` — cards do kanban (1 por paciente/tenant)
- `cp_kanban_historico` — histórico de movimentações
- `cp_escalacoes` — escalações para humano
- `cp_mensagens` — histórico de mensagens
- `cp_atendimento_humano` — controle de modo humano ativo
- `cp_mensagens_operador` — mensagens enviadas por operadores
- `cp_assistente_historico` — histórico do assistente IA
- `cp_audit_log` — log de auditoria completo
- `cp_tenant_config` — configurações key-value por tenant

---

## O Que Foi Implementado

### Fase 0 — Fundação Multi-Tenant ✅
- Todas as coleções `cp_*` criadas no MongoDB
- Autenticação JWT com `tenant_id` + `role` no payload
- Middleware de isolamento por tenant em todas as rotas
- Seed com 2 tenants demo + super-admin

### Fase 1 — Conversas e Escalação ✅
- Tela de Conversas: lista + chat (3 colunas)
- Webhook `/api/webhook/escalacao` recebendo do n8n
- WebSocket em tempo real para notificações
- Botão "Assumir Conversa" + "Devolver para IA"
- Envio de mensagem manual por operador

### Fase 2 — Kanban ✅
- Webhook `/api/webhook/kanban` para atualização automática
- Kanban com drag-and-drop (HTML5 nativo)
- 8 colunas de status + coluna Cancelado (oculta por padrão)
- Cards com urgência visual (borda pulsante vermelha > 5min)
- Histórico de movimentações por card
- Atualização em tempo real via WebSocket

### Fase 3 — Agendamentos e Assistente ✅
- Calendário mensal/semanal com dots em dias com consultas
- Filtro por profissional
- Chat Assistente IA com Google Gemini 2.5 Flash
- Chips de comandos rápidos
- Histórico persistido por tenant/operador

### Fase 4 — Dashboard e Configurações ✅
- Dashboard com 4 cards de métricas + 2 gráficos
- Gráfico de volume de mensagens (24h) — LineChart
- Lista de consultas do dia + escalações recentes
- Configurações: Equipe, Profissionais, Horários, Mensagens, Notificações, Integrações, Plano
- Alertas/Escalações com SLA visual e notificações browser

### Fase 5 — Super-Admin ✅
- Painel Super-Admin em `/admin/*`
- Login com TOTP 2FA obrigatório
- Dashboard global com métricas de todos os tenants
- Gestão de clínicas (criar, suspender, reativar)
- Impersonation com redirect completo
- Monitor de saúde dos serviços
- Logs globais com export CSV

---

## Credenciais de Demo

| Usuário | Email | Senha | Observação |
|---------|-------|-------|------------|
| Super Admin (Jailson) | jailson.silva0933@gmail.com | Admin@2026 | TOTP: JBSWY3DPEHPK3PXP |
| Clínica Moreira (Admin) | admin@clinicamoreira.com | Clinica@123 | Plano Pro |
| Clínica Moreira (Recep) | recep@clinicamoreira.com | Clinica@123 | Operador |
| Clínica Silva (Admin) | admin@clinicasilva.com | Clinica@123 | Plano Starter |

---

## Backlog / Próximas Fases

### P0 — ✅ Concluído (Abr 2026)
- [x] Google Calendar API real — OAuth2 por tenant + leitura/escrita de eventos
- [x] Evolution API real — envio de WhatsApp via `httpx` para `/message/sendText/{instance}`
- [x] n8n webhook integration — validação de `x-webhook-secret` por tenant
- [x] Stripe Checkout/Subscriptions — planos Starter (R$99), Pro (R$299), Enterprise (R$799)
- [x] Web Push notifications — Service Worker + VAPID + broadcast em escalações

### P1 — Média Prioridade
- [ ] Alerta sonoro configurável
- [ ] Filtro por profissional/data no Kanban
- [ ] Histórico de movimentações visível no card (modal)
- [ ] Confirmação de consulta automática (trigger diário)
- [ ] Sincronização bidirecional Google Calendar ↔ Kanban (criar consultas no calendário ao mover card para "agendado")

### P2 — Baixa Prioridade / Fase 6
- [ ] Limites automatizados por plano (conversas/mês) com alertas
- [ ] Exportação de relatórios CSV/PDF
- [ ] Stripe webhook signature validation com STRIPE_WEBHOOK_SECRET em produção
- [ ] App mobile (PWA)
- [ ] Módulo de relatórios avançados
