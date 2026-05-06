"""
ClinicaPanel v2.0 — Script de Seed
Cria dados de demonstração no MongoDB.

Usage: python seed.py
"""
import asyncio
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pathlib import Path
from dotenv import load_dotenv
import random

load_dotenv(Path(__file__).parent / '.env')

from database import db
from auth import hash_pwd


def now_iso(delta_minutes=0):
    return (datetime.now(timezone.utc) + timedelta(minutes=delta_minutes)).isoformat()


def future_dt(days=1, hour=10, minute=0):
    d = datetime.now(timezone.utc) + timedelta(days=days)
    return d.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


async def seed():
    print("Limpando dados existentes...")
    cols = [
        'cp_tenants', 'cp_operadores', 'cp_super_admins', 'cp_profissionais',
        'cp_kanban_cards', 'cp_kanban_historico', 'cp_escalacoes',
        'cp_mensagens', 'cp_atendimento_humano', 'cp_mensagens_operador',
        'cp_assistente_historico', 'cp_audit_log', 'cp_tenant_config', 'status_checks'
    ]
    for col in cols:
        await db[col].delete_many({})

    print("Criando Super Admin...")
    sa_result = await db.cp_super_admins.insert_one({
        "nome": "Jailson Silva",
        "email": "jailson.silva0933@gmail.com",
        "senha_hash": hash_pwd("Admin@2026"),
        "totp_secret": "JBSWY3DPEHPK3PXP",  # Test TOTP secret
        "ativo": True,
        "criado_em": now_iso(),
    })
    print(f"  Super Admin ID: {sa_result.inserted_id}")

    # ─────────────────────────────────────────────
    # TENANT 1: Clínica Moreira
    # ─────────────────────────────────────────────
    print("\nCriando Tenant 1: Clínica Moreira...")
    t1_result = await db.cp_tenants.insert_one({
        "nome": "Clínica Moreira",
        "slug": "clinicamoreira",
        "cnpj": "12.345.678/0001-90",
        "email_contato": "contato@clinicamoreira.com.br",
        "telefone_contato": "(11) 3456-7890",
        "plano": "pro",
        "status": "ativo",
        "instancia_evolution": "clinica_moreira",
        "webhook_secret": "wh_moreira_secret_123",
        "url_n8n": "https://n8n.example.com",
        "url_evolution": "https://evolution.example.com",
        "criado_em": now_iso(-30 * 24 * 60),
        "atualizado_em": now_iso(),
    })
    t1_id = str(t1_result.inserted_id)
    print(f"  Tenant 1 ID: {t1_id}")

    # Profissionais Tenant 1
    prof1_result = await db.cp_profissionais.insert_one({
        "tenant_id": t1_id,
        "nome": "Dr. João Paulo",
        "especialidade": "Clínico Geral",
        "tipo": "medico",
        "calendar_id": "joaopaulo@clinicamoreira.com",
        "ativo": True,
        "criado_em": now_iso(),
    })
    prof1_id = str(prof1_result.inserted_id)

    prof2_result = await db.cp_profissionais.insert_one({
        "tenant_id": t1_id,
        "nome": "Dra. Ana Lima",
        "especialidade": "Cardiologia",
        "tipo": "medico",
        "calendar_id": "analima@clinicamoreira.com",
        "ativo": True,
        "criado_em": now_iso(),
    })
    prof2_id = str(prof2_result.inserted_id)

    # Operadores Tenant 1
    await db.cp_operadores.insert_one({
        "tenant_id": t1_id,
        "nome": "Admin Moreira",
        "email": "admin@clinicamoreira.com",
        "senha_hash": hash_pwd("Clinica@123"),
        "nivel": "admin",
        "ativo": True,
        "criado_em": now_iso(),
    })

    op1_result = await db.cp_operadores.insert_one({
        "tenant_id": t1_id,
        "nome": "Ana Recepção",
        "email": "recep@clinicamoreira.com",
        "senha_hash": hash_pwd("Clinica@123"),
        "nivel": "operador",
        "ativo": True,
        "criado_em": now_iso(),
    })
    op1_id = str(op1_result.inserted_id)

    # Config Tenant 1
    configs_t1 = [
        {"chave": "horario_inicio", "valor": "08:00"},
        {"chave": "horario_fim", "valor": "18:00"},
        {"chave": "mensagem_fora_horario", "valor": "Olá! Nossa secretária virtual atende de 8h às 18h. Retornaremos em breve."},
        {"chave": "sla_resposta_humana", "valor": "5"},
        {"chave": "alerta_sonoro", "valor": "true"},
    ]
    for c in configs_t1:
        await db.cp_tenant_config.insert_one({"tenant_id": t1_id, **c})

    # Kanban cards Tenant 1
    patients_t1 = [
        {
            "telefone": "11912345678",
            "nome_paciente": "Maria Santos",
            "status": "aguardando_humano",
            "ultima_mensagem": "Preciso de um atendimento urgente por favor",
            "profissional_id": prof2_id,
            "proximo_agendamento": None,
            "delta_min": -8,
        },
        {
            "telefone": "11923456789",
            "nome_paciente": "João Silva",
            "status": "agendado",
            "ultima_mensagem": "Certo, ficou marcado! Obrigado.",
            "profissional_id": prof1_id,
            "proximo_agendamento": future_dt(days=3, hour=14, minute=0),
            "delta_min": -45,
        },
        {
            "telefone": "11934567890",
            "nome_paciente": "Pedro Almeida",
            "status": "agendando",
            "ultima_mensagem": "Quais são os horários disponíveis para esta semana?",
            "profissional_id": prof1_id,
            "proximo_agendamento": None,
            "delta_min": -3,
        },
        {
            "telefone": "11945678901",
            "nome_paciente": "Carlos Mendes",
            "status": "confirmado",
            "ultima_mensagem": "Confirmo minha presença na consulta de amanhã.",
            "profissional_id": prof2_id,
            "proximo_agendamento": future_dt(days=1, hour=10, minute=0),
            "delta_min": -120,
        },
        {
            "telefone": "11956789012",
            "nome_paciente": "Ana Beatriz",
            "status": "em_atendimento",
            "ultima_mensagem": "Olá, gostaria de marcar uma consulta",
            "profissional_id": None,
            "proximo_agendamento": None,
            "delta_min": -2,
        },
        {
            "telefone": "11967890123",
            "nome_paciente": "Roberto Ferreira",
            "status": "aguardando_humano",
            "ultima_mensagem": "Preciso cancelar minha consulta mas a IA não está me ajudando",
            "profissional_id": prof1_id,
            "proximo_agendamento": future_dt(days=2, hour=16, minute=30),
            "delta_min": -12,
        },
        {
            "telefone": "11978901234",
            "nome_paciente": "Fernanda Lima",
            "status": "novo_contato",
            "ultima_mensagem": "Oi! Quero marcar uma consulta com o Dr. João",
            "profissional_id": None,
            "proximo_agendamento": None,
            "delta_min": -1,
        },
        {
            "telefone": "11989012345",
            "nome_paciente": "Marco Oliveira",
            "status": "atendido",
            "ultima_mensagem": "Muito obrigado pelo atendimento!",
            "profissional_id": prof1_id,
            "proximo_agendamento": None,
            "delta_min": -180,
        },
        {
            "telefone": "11990123456",
            "nome_paciente": "Lucia Costa",
            "status": "remarcando",
            "ultima_mensagem": "Preciso remarcar para a semana que vem",
            "profissional_id": prof2_id,
            "proximo_agendamento": future_dt(days=5, hour=9, minute=0),
            "delta_min": -20,
        },
        {
            "telefone": "11991234567",
            "nome_paciente": "Bruno Ramos",
            "status": "cancelado",
            "ultima_mensagem": "Vou ter que cancelar, infelizmente",
            "profissional_id": prof1_id,
            "proximo_agendamento": None,
            "delta_min": -240,
        },
    ]

    card_ids = {}
    for p in patients_t1:
        ts = now_iso(p["delta_min"])
        result = await db.cp_kanban_cards.insert_one({
            "tenant_id": t1_id,
            "telefone": p["telefone"],
            "instancia": "clinica_moreira",
            "nome_paciente": p["nome_paciente"],
            "status": p["status"],
            "profissional_id": p["profissional_id"],
            "proximo_agendamento": p["proximo_agendamento"],
            "ultima_mensagem": p["ultima_mensagem"],
            "ultima_atividade": ts,
            "tempo_no_status_desde": ts,
            "criado_em": ts,
        })
        card_ids[p["telefone"]] = str(result.inserted_id)

        # Add some messages for each conversation
        await db.cp_mensagens.insert_many([
            {
                "tenant_id": t1_id,
                "telefone": p["telefone"],
                "tipo": "paciente",
                "conteudo": f"Olá! Sou {p['nome_paciente']}.",
                "enviado_em": now_iso(p["delta_min"] - 5),
            },
            {
                "tenant_id": t1_id,
                "telefone": p["telefone"],
                "tipo": "ia",
                "conteudo": f"Olá, {p['nome_paciente'].split()[0]}! Bem-vindo à Clínica Moreira. Como posso ajudá-lo hoje?",
                "enviado_em": now_iso(p["delta_min"] - 4),
            },
            {
                "tenant_id": t1_id,
                "telefone": p["telefone"],
                "tipo": "paciente",
                "conteudo": p["ultima_mensagem"],
                "enviado_em": now_iso(p["delta_min"]),
            },
        ])

        # Kanban history
        await db.cp_kanban_historico.insert_one({
            "tenant_id": t1_id,
            "card_id": card_ids[p["telefone"]],
            "status_anterior": None,
            "status_novo": "novo_contato",
            "origem": "automatico",
            "motivo": "Primeiro contato",
            "timestamp": now_iso(p["delta_min"] - 5),
        })
        if p["status"] != "novo_contato":
            await db.cp_kanban_historico.insert_one({
                "tenant_id": t1_id,
                "card_id": card_ids[p["telefone"]],
                "status_anterior": "novo_contato",
                "status_novo": p["status"],
                "origem": "automatico",
                "motivo": "Atualizado pela IA",
                "timestamp": now_iso(p["delta_min"]),
            })

    # Escalações Tenant 1
    await db.cp_escalacoes.insert_many([
        {
            "tenant_id": t1_id,
            "telefone": "11912345678",
            "instancia": "clinica_moreira",
            "motivo": "Paciente Maria Santos relata dor intensa e precisa de orientação médica urgente.",
            "nome_paciente": "Maria Santos",
            "recebido_em": now_iso(-8),
            "assumido_em": None,
            "resolvido_em": None,
            "operador_id": None,
        },
        {
            "tenant_id": t1_id,
            "telefone": "11967890123",
            "instancia": "clinica_moreira",
            "motivo": "Roberto Ferreira está com dificuldade para cancelar consulta.",
            "nome_paciente": "Roberto Ferreira",
            "recebido_em": now_iso(-12),
            "assumido_em": None,
            "resolvido_em": None,
            "operador_id": None,
        },
        {
            "tenant_id": t1_id,
            "telefone": "11989012345",
            "instancia": "clinica_moreira",
            "motivo": "Paciente Marco Oliveira perguntou sobre exame específico.",
            "nome_paciente": "Marco Oliveira",
            "recebido_em": now_iso(-200),
            "assumido_em": now_iso(-180),
            "resolvido_em": now_iso(-170),
            "operador_id": op1_id,
        },
    ])

    # ─────────────────────────────────────────────
    # TENANT 2: Clínica Silva
    # ─────────────────────────────────────────────
    print("\nCriando Tenant 2: Clínica Silva...")
    t2_result = await db.cp_tenants.insert_one({
        "nome": "Clínica Silva",
        "slug": "clinicasilva",
        "cnpj": "98.765.432/0001-10",
        "email_contato": "contato@clinicasilva.com.br",
        "telefone_contato": "(11) 4567-8901",
        "plano": "starter",
        "status": "ativo",
        "instancia_evolution": "clinica_silva",
        "webhook_secret": "wh_silva_secret_456",
        "url_n8n": "https://n8n.example.com",
        "url_evolution": "https://evolution.example.com",
        "criado_em": now_iso(-15 * 24 * 60),
        "atualizado_em": now_iso(),
    })
    t2_id = str(t2_result.inserted_id)

    prof3_result = await db.cp_profissionais.insert_one({
        "tenant_id": t2_id,
        "nome": "Dr. Carlos Silva",
        "especialidade": "Ortopedia",
        "tipo": "medico",
        "calendar_id": "carlossilva@clinicasilva.com",
        "ativo": True,
        "criado_em": now_iso(),
    })
    prof3_id = str(prof3_result.inserted_id)

    await db.cp_operadores.insert_one({
        "tenant_id": t2_id,
        "nome": "Admin Silva",
        "email": "admin@clinicasilva.com",
        "senha_hash": hash_pwd("Clinica@123"),
        "nivel": "admin",
        "ativo": True,
        "criado_em": now_iso(),
    })

    configs_t2 = [
        {"chave": "horario_inicio", "valor": "09:00"},
        {"chave": "horario_fim", "valor": "17:00"},
        {"chave": "sla_resposta_humana", "valor": "10"},
    ]
    for c in configs_t2:
        await db.cp_tenant_config.insert_one({"tenant_id": t2_id, **c})

    patients_t2 = [
        {"telefone": "11911111111", "nome_paciente": "Sofia Martins", "status": "agendado", "delta": -30,
         "msg": "Ótimo, estou aguardando a consulta!", "profissional_id": prof3_id,
         "proximo_agendamento": future_dt(days=2, hour=11)},
        {"telefone": "11922222222", "nome_paciente": "Ricardo Gomes", "status": "em_atendimento", "delta": -5,
         "msg": "Preciso de uma consulta de urgência", "profissional_id": None, "proximo_agendamento": None},
        {"telefone": "11933333333", "nome_paciente": "Patrícia Nunes", "status": "confirmado", "delta": -90,
         "msg": "Confirmado! Estarei lá.", "profissional_id": prof3_id,
         "proximo_agendamento": future_dt(days=1, hour=15)},
        {"telefone": "11944444444", "nome_paciente": "Eduardo Castro", "status": "novo_contato", "delta": -1,
         "msg": "Olá, quero marcar uma consulta", "profissional_id": None, "proximo_agendamento": None},
        {"telefone": "11955555555", "nome_paciente": "Camila Pereira", "status": "aguardando_humano", "delta": -15,
         "msg": "Não consigo resolver pelo atendimento automático", "profissional_id": prof3_id,
         "proximo_agendamento": None},
    ]

    for p in patients_t2:
        ts = now_iso(p["delta"])
        r = await db.cp_kanban_cards.insert_one({
            "tenant_id": t2_id,
            "telefone": p["telefone"],
            "instancia": "clinica_silva",
            "nome_paciente": p["nome_paciente"],
            "status": p["status"],
            "profissional_id": p.get("profissional_id"),
            "proximo_agendamento": p.get("proximo_agendamento"),
            "ultima_mensagem": p["msg"],
            "ultima_atividade": ts,
            "tempo_no_status_desde": ts,
            "criado_em": ts,
        })
        await db.cp_mensagens.insert_many([
            {"tenant_id": t2_id, "telefone": p["telefone"], "tipo": "paciente",
             "conteudo": f"Oi, sou {p['nome_paciente']}.", "enviado_em": now_iso(p["delta"] - 3)},
            {"tenant_id": t2_id, "telefone": p["telefone"], "tipo": "ia",
             "conteudo": "Olá! Bem-vindo à Clínica Silva. Como posso ajudá-lo?", "enviado_em": now_iso(p["delta"] - 2)},
            {"tenant_id": t2_id, "telefone": p["telefone"], "tipo": "paciente",
             "conteudo": p["msg"], "enviado_em": ts},
        ])

    print("\n✅ Seed concluído com sucesso!")
    print("\n=== CREDENCIAIS ===")
    print(f"Super Admin: jailson.silva0933@gmail.com / Admin@2026")
    print(f"  TOTP Secret: JBSWY3DPEHPK3PXP")
    print(f"  Use https://totp.app ou Google Authenticator com esse secret")
    print(f"\nClínica Moreira (admin): admin@clinicamoreira.com / Clinica@123")
    print(f"Clínica Moreira (recep): recep@clinicamoreira.com / Clinica@123")
    print(f"Clínica Silva (admin): admin@clinicasilva.com / Clinica@123")


if __name__ == "__main__":
    asyncio.run(seed())
