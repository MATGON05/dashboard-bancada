# SUIT-TECH v4 - Design Revisado

## Mudanças solicitadas

### 1. Remover Assistência Técnica
- Remover link "Assistência Técnica" do menu lateral de todas as páginas.
- Não excluir arquivos, apenas remover a navegação.

### 2. Controle de Caixa (Entradas)
Nova tabela `cash_in`:
- id, date, description, type (Serviço/Produto), sale_value, cost, profit, created_at

Nova página `caixa-entrada.html`:
- Listagem de entradas
- Botão "Nova Entrada"
- Campos: Data, Descrição, Tipo (Serviço/Produto), Valor da Venda, Custo
- Lucro calculado automaticamente: sale_value - cost
- Gráfico mensal: entradas por dia/mês (barras)
- Filtro por mês/ano

### 3. Caixa de Saída (Gastos)
Nova tabela `cash_out`:
- id, date, description, amount, paid (boolean), created_at

Nova página `caixa-saida.html`:
- Listagem de saídas
- Botão "Nova Saída"
- Campos: Data, Descrição, Valor, Pago (checkbox)
- Gráfico mensal: saídas por dia/mês (barras)
- Filtro por mês/ano
- Total pago e total não pago

### 4. Relatórios
- Atualizar página `relatorios.html`.
- Abas/seções:
  - Relatório de Orçamentos (existente)
  - Relatório de Caixa de Entrada
  - Relatório de Caixa de Saída
- Gráficos para cada relatório usando Chart.js.
- Botão para baixar PDF de cada relatório.

### 5. PDF do Orçamento
- No cabeçalho do PDF, manter apenas:
  - Nome: SUIT-TECH
  - Telefone: 24999421921
- Remover CNPJ, endereço e email da empresa.
- Manter layout profissional.

## Dependências
- chart.js (CDN no frontend)

## Arquivos afetados
- server.js: novas tabelas e rotas
- public/app.js: novas funções
- public/index.html: remover assistencia, adicionar caixa-entrada e caixa-saida
- public/orcamentos.html: remover assistencia, adicionar caixa-entrada e caixa-saida
- public/agendamentos.html: remover assistencia, adicionar caixa-entrada e caixa-saida
- public/clientes.html: remover assistencia, adicionar caixa-entrada e caixa-saida
- public/relatorios.html: adicionar abas e gráficos
- public/caixa-entrada.html: nova página
- public/caixa-saida.html: nova página
- public/style.css: ajustes de gráfico

## Próximo passo
Implementar todas as mudanças.
