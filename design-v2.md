# SUIT-TECH v2 - Design Revisado

## Mudanças solicitadas

### 1. Dashboard
- Remover o botão "+ Novo Orçamento" do header da Dashboard.
- Manter botão nas páginas Orçamentos, Assistência Técnica e Clientes.

### 2. Controle financeiro por orçamento
Novos campos na tabela `budgets`:
- `parts_cost` (decimal): valor das peças
- `extra_cost` (decimal): custos extras (mão de obra, transporte, etc.)
- `profit_margin` (decimal): margem de lucro desejada (% ou valor)
- `financial_notes` (text): observações internas de custo

No modal de orçamento haverá uma seção "Financeiro" com:
- Valor do serviço (já existente)
- Valor das peças
- Custos extras
- Margem de lucro (%)
- Valor final calculado automaticamente
- Observações financeiras

Cálculo:
```
valor_final = valor_servico + parts_cost + extra_cost + lucro
lucro = (valor_servico + parts_cost + extra_cost) * (profit_margin / 100)
```

### 3. Agendamentos
Nova tabela `appointments`:
- `id`, `budget_id`, `appointment_date`, `reminder` (boolean), `status`, `notes`, `created_at`, `updated_at`

Nova tela "Agendamentos" no menu lateral.
Botão "Agendar" nos orçamentos abre modal para marcar data/hora.
Status: Agendado, Confirmado, Cancelado, Concluído.

### 4. PDF profissional
Layout do PDF:
- Cabeçalho com logo/nome SUIT-TECH e dados da empresa
- Número do orçamento e data
- Dados do cliente
- Dados do aparelho
- Defeito relatado e diagnóstico
- Tabela de valores (serviço, peças, extras, lucro, total)
- Termos de garantia e responsabilidade
- Assinatura do cliente e do técnico

Biblioteca: `pdfkit` (mais leve, não precisa de Chromium).

### 5. Envio de PDF por email
- Botão "Enviar PDF" na listagem de orçamentos.
- Configuração SMTP via arquivo `.env`:
  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- Usar `nodemailer`.
- Se SMTP não estiver configurado, exibir mensagem informativa e permitir baixar o PDF.

## Dependências adicionais
- `pdfkit`
- `nodemailer`
- `dotenv`

## Telas afetadas
- `index.html`: remoção do botão
- `orcamentos.html`: novos campos, botões PDF/enviar, modal de agendamento
- `assistencia.html`: nenhuma mudança estrutural
- `clientes.html`: nenhuma mudança estrutural
- Nova `agendamentos.html`
- `server.js`: novos endpoints e tabelas
- `app.js`: novas funções
- `style.css`: ajustes leves de formulário

## Próximo passo
Aguardar aprovação do design para iniciar implementação.
