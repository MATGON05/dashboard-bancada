# SUIT-TECH v3 - Design Revisado

## Mudanças solicitadas

### 1. Envio de PDF por email ao cliente
- Botão "Enviar PDF" envia o PDF diretamente para o email cadastrado do cliente.
- O sistema usa a configuração SMTP do arquivo `.env`.
- Se `.env` não estiver configurado, mostrar modal explicando como configurar.
- Se o cliente não tiver email cadastrado, avisar e permitir digitar um email temporário.

### 2. Pasta `orcamentos/`
- Criar pasta `orcamentos/` dentro do projeto.
- Toda vez que um PDF for gerado, salvar automaticamente como `orcamentos/orcamento-{id}.pdf`.
- Botão "Baixar PDF" e "Enviar PDF" usam esse arquivo salvo.

### 3. Botão de envio de garantia
- Quando o status do orçamento for "Entregue", aparecer botão "Enviar Garantia".
- A garantia é um PDF próprio com:
  - Dados do cliente e aparelho
  - Data de entrega
  - Prazo de garantia (90 dias por padrão)
  - Termos de garantia
  - Assinaturas
- Enviado automaticamente por email para o cliente.
- Também salvo na pasta `orcamentos/garantia-{id}.pdf`.

### 4. Relatório mensal completo
- Nova página "Relatórios" no menu lateral.
- Botão para selecionar mês/ano.
- Gerar PDF com:
  - Total de orçamentos no mês
  - Total de orçamentos por status
  - Total de orçamentos por tipo de aparelho
  - Faturamento total
  - Custos totais (peças + extras)
  - Lucro estimado
  - Lista de todos os orçamentos do mês
  - Lista de agendamentos do mês
- Salvar em `relatorios/relatorio-mensal-AAAA-MM.pdf`.
- Botão para enviar relatório por email (email do destinatário informado manualmente).

## Arquivos afetados
- `server.js`: novas rotas e lógica de PDF/email
- `public/app.js`: novas funções de frontend
- `public/orcamentos.html`: botões de garantia
- `public/relatorios.html`: nova página
- `public/style.css`: estilos adicionais
- `package.json`: sem mudanças
- `.env.example`: já existe

## Próximo passo
Aguardar aprovação do design para implementar.
