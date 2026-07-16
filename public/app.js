const API = '';

function money(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('pt-BR');
}

function badgeClass(status) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '-');
  return 'badge badge-' + key;
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro na requisição');
  return res.json();
}

// DASHBOARD
async function loadDashboard() {
  const data = await api('/api/dashboard');
  document.getElementById('stat-total').textContent = data.totals.total || 0;
  document.getElementById('stat-pending').textContent = data.totals.pending || 0;
  document.getElementById('stat-approved').textContent = data.totals.approved || 0;
  document.getElementById('stat-completed').textContent = data.totals.completed || 0;
  document.getElementById('stat-delivered').textContent = data.totals.delivered || 0;
  document.getElementById('stat-cancelled').textContent = data.totals.cancelled || 0;
  document.getElementById('stat-revenue').textContent = money(data.totals.revenue);

  const recentBody = document.getElementById('recent-table');
  recentBody.innerHTML = data.recent.length
    ? data.recent.map(b => `
        <tr>
          <td>#${b.id}</td>
          <td>${b.client_name || 'Não informado'}</td>
          <td>${b.device_type} ${b.brand || ''} ${b.model || ''}</td>
          <td>${b.problem || '-'}</td>
          <td>${money(b.value)}</td>
          <td><span class="${badgeClass(b.status)}">${b.status}</span></td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="empty">Nenhum orçamento ainda</td></tr>';

  const osGrid = document.getElementById('os-status-grid');
  osGrid.innerHTML = data.osByStatus.length
    ? data.osByStatus.map(s => `
        <div class="status-card">
          <strong>${s.count}</strong>
          <span>${s.status}</span>
        </div>`).join('')
    : '<p class="empty">Nenhuma ordem de serviço</p>';
}

// CLIENTS
let clientsCache = [];

async function loadClients() {
  clientsCache = await api('/api/clients');
  renderClients();
}

function renderClients() {
  const q = document.getElementById('search-client')?.value.toLowerCase() || '';
  const tbody = document.getElementById('clients-table');
  const filtered = clientsCache.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.phone || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  );
  tbody.innerHTML = filtered.length
    ? filtered.map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.phone || '-'}</td>
          <td>${c.email || '-'}</td>
          <td>${c.cpf || '-'}</td>
          <td>${c.address || '-'}</td>
          <td class="actions">
            <button class="btn" onclick="editClient(${c.id})">Editar</button>
            <button class="btn btn-danger" onclick="deleteClient(${c.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="6" class="empty">Nenhum cliente encontrado</td></tr>';
}

async function loadClientsIntoSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  clientsCache = await api('/api/clients');
  select.innerHTML = '<option value="">Selecione um cliente</option>' +
    clientsCache.map(c => `<option value="${c.id}">${c.name} - ${c.phone || ''}</option>`).join('');
}

function openClientModal(client = null) {
  document.getElementById('client-modal-title').textContent = client ? 'Editar Cliente' : 'Novo Cliente';
  document.getElementById('client-id').value = client ? client.id : '';
  document.getElementById('client-name').value = client ? client.name : '';
  document.getElementById('client-phone').value = client ? client.phone : '';
  document.getElementById('client-email').value = client ? client.email : '';
  document.getElementById('client-cpf').value = client ? client.cpf : '';
  document.getElementById('client-address').value = client ? client.address : '';
  document.getElementById('client-modal').classList.add('open');
}

function closeClientModal() {
  document.getElementById('client-modal').classList.remove('open');
}

async function saveClient(e) {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const body = {
    name: document.getElementById('client-name').value,
    phone: document.getElementById('client-phone').value,
    email: document.getElementById('client-email').value,
    cpf: document.getElementById('client-cpf').value,
    address: document.getElementById('client-address').value
  };
  if (id) await api(`/api/clients/${id}`, { method: 'PUT', body });
  else await api('/api/clients', { method: 'POST', body });
  closeClientModal();
  await loadClients();
}

async function editClient(id) {
  const c = clientsCache.find(x => x.id === id);
  if (c) openClientModal(c);
}

async function deleteClient(id) {
  if (!confirm('Excluir cliente?')) return;
  await api(`/api/clients/${id}`, { method: 'DELETE' });
  await loadClients();
}

// BUDGETS
let budgetsCache = [];

async function loadBudgets() {
  budgetsCache = await api('/api/budgets');
  await loadClientsIntoSelect('budget-client');
  renderBudgets();
}

function renderBudgets() {
  const q = document.getElementById('search-budget')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-status')?.value || '';
  const tbody = document.getElementById('budgets-table');
  const filtered = budgetsCache.filter(b => {
    const matchesSearch =
      (b.client_name || '').toLowerCase().includes(q) ||
      (b.device_type || '').toLowerCase().includes(q) ||
      (b.brand || '').toLowerCase().includes(q) ||
      (b.model || '').toLowerCase().includes(q) ||
      (b.problem || '').toLowerCase().includes(q);
    const matchesStatus = status ? b.status === status : true;
    return matchesSearch && matchesStatus;
  });
  tbody.innerHTML = filtered.length
    ? filtered.map(b => `
        <tr>
          <td>#${b.id}</td>
          <td>${formatDate(b.created_at)}</td>
          <td>${b.client_name || 'Não informado'}</td>
          <td>${b.device_type} ${b.brand || ''} ${b.model || ''}</td>
          <td>${b.problem || '-'}</td>
          <td>${money(b.value)}</td>
          <td><span class="${badgeClass(b.status)}">${b.status}</span></td>
          <td class="actions">
            <button class="btn" onclick="editBudget(${b.id})">Editar</button>
            <button class="btn" onclick="printBudget(${b.id})">Imprimir</button>
            <button class="btn" onclick="downloadPdf(${b.id})">PDF</button>
            <button class="btn" onclick="sendPdfEmail(${b.id})">Enviar PDF</button>
            <button class="btn" onclick="openAppointmentModalFromBudget(${b.id})">Agendar</button>
            ${b.status === 'Entregue' ? `<button class="btn" onclick="downloadWarranty(${b.id})">Garantia</button>
            <button class="btn" onclick="sendWarrantyEmail(${b.id})">Enviar Garantia</button>` : ''}
            <button class="btn btn-danger" onclick="deleteBudget(${b.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="8" class="empty">Nenhum orçamento encontrado</td></tr>';
}

function openBudgetModal(budget = null) {
  document.getElementById('budget-modal-title').textContent = budget ? 'Editar Orçamento' : 'Novo Orçamento';
  document.getElementById('budget-id').value = budget ? budget.id : '';
  document.getElementById('budget-client').value = budget ? budget.client_id || '' : '';
  document.getElementById('budget-device').value = budget ? budget.device_type : '';
  document.getElementById('budget-status').value = budget ? budget.status : 'Pendente';
  document.getElementById('budget-brand').value = budget ? budget.brand || '' : '';
  document.getElementById('budget-model').value = budget ? budget.model || '' : '';
  document.getElementById('budget-serial').value = budget ? budget.serial || '' : '';
  document.getElementById('budget-value').value = budget ? budget.value || '' : '';
  document.getElementById('budget-parts-cost').value = budget ? budget.parts_cost || '' : '';
  document.getElementById('budget-extra-cost').value = budget ? budget.extra_cost || '' : '';
  document.getElementById('budget-profit-margin').value = budget ? budget.profit_margin || '' : '';
  document.getElementById('budget-financial-notes').value = budget ? budget.financial_notes || '' : '';
  calculateFinalValue();
  document.getElementById('budget-problem').value = budget ? budget.problem || '' : '';
  document.getElementById('budget-diagnosis').value = budget ? budget.diagnosis || '' : '';
  document.getElementById('budget-modal').classList.add('open');
}

function calculateFinalValue() {
  const v = parseFloat(document.getElementById('budget-value')?.value) || 0;
  const p = parseFloat(document.getElementById('budget-parts-cost')?.value) || 0;
  const e = parseFloat(document.getElementById('budget-extra-cost')?.value) || 0;
  const m = parseFloat(document.getElementById('budget-profit-margin')?.value) || 0;
  const subtotal = v + p + e;
  const profit = subtotal * (m / 100);
  const final = subtotal + profit;
  const el = document.getElementById('budget-final-value');
  if (el) el.value = money(final).replace('R$ ', '');
}

function closeBudgetModal() {
  document.getElementById('budget-modal').classList.remove('open');
}

async function saveBudget(e) {
  e.preventDefault();
  const id = document.getElementById('budget-id').value;
  const body = {
    client_id: document.getElementById('budget-client').value || null,
    device_type: document.getElementById('budget-device').value,
    brand: document.getElementById('budget-brand').value,
    model: document.getElementById('budget-model').value,
    serial: document.getElementById('budget-serial').value,
    problem: document.getElementById('budget-problem').value,
    diagnosis: document.getElementById('budget-diagnosis').value,
    value: parseFloat(document.getElementById('budget-value').value) || 0,
    parts_cost: parseFloat(document.getElementById('budget-parts-cost').value) || 0,
    extra_cost: parseFloat(document.getElementById('budget-extra-cost').value) || 0,
    profit_margin: parseFloat(document.getElementById('budget-profit-margin').value) || 0,
    financial_notes: document.getElementById('budget-financial-notes').value,
    status: document.getElementById('budget-status').value
  };
  if (id) await api(`/api/budgets/${id}`, { method: 'PUT', body });
  else await api('/api/budgets', { method: 'POST', body });
  closeBudgetModal();
  await loadBudgets();
}

async function editBudget(id) {
  const b = await api(`/api/budgets/${id}`);
  if (b) openBudgetModal(b);
}

async function deleteBudget(id) {
  if (!confirm('Excluir orçamento?')) return;
  await api(`/api/budgets/${id}`, { method: 'DELETE' });
  await loadBudgets();
}

async function printBudget(id) {
  const b = await api(`/api/budgets/${id}`);
  const win = window.open('', '_blank');
  const service = Number(b.value || 0);
  const parts = Number(b.parts_cost || 0);
  const extra = Number(b.extra_cost || 0);
  const margin = Number(b.profit_margin || 0);
  const subtotal = service + parts + extra;
  const profit = subtotal * (margin / 100);
  const total = subtotal + profit;
  win.document.write(`
    <html>
      <head><title>Orçamento #${b.id}</title></head>
      <body style="font-family:Arial; padding:40px; max-width:700px; margin:auto;">
        <h1>SUIT-TECH - Orçamento #${b.id}</h1>
        <p><strong>Data:</strong> ${formatDate(b.created_at)}</p>
        <p><strong>Cliente:</strong> ${b.client_name || 'Não informado'}</p>
        <p><strong>Telefone:</strong> ${b.client_phone || '-'}</p>
        <hr>
        <p><strong>Aparelho:</strong> ${b.device_type} ${b.brand || ''} ${b.model || ''}</p>
        <p><strong>Defeito:</strong> ${b.problem || '-'}</p>
        <p><strong>Diagnóstico:</strong> ${b.diagnosis || '-'}</p>
        <p><strong>Valor do Serviço:</strong> ${money(service)}</p>
        <p><strong>Valor das Peças:</strong> ${money(parts)}</p>
        <p><strong>Custos Extras:</strong> ${money(extra)}</p>
        <p><strong>Margem de Lucro:</strong> ${margin}%</p>
        <p><strong>Valor Final:</strong> ${money(total)}</p>
        <p><strong>Status:</strong> ${b.status}</p>
      </body>
    </html>
  `);
  win.document.close();
  win.print();
}

async function downloadPdf(id) {
  window.open(`/api/budgets/${id}/pdf`, '_blank');
}

async function sendPdfEmail(id) {
  try {
    const res = await fetch(`/api/budgets/${id}/send-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok && data.configured === false) {
      if (confirm(data.message + ' Deseja baixar o PDF agora?')) {
        downloadPdf(id);
      }
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar e-mail');
    alert(data.message);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// SERVICE ORDERS
let osCache = [];

async function loadServiceOrders() {
  osCache = await api('/api/service-orders');
  renderServiceOrders();
}

function renderServiceOrders() {
  const q = document.getElementById('search-os')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-os-status')?.value || '';
  const tbody = document.getElementById('os-table');
  const filtered = osCache.filter(o => {
    const matchesSearch =
      String(o.id).includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.device_type || '').toLowerCase().includes(q) ||
      (o.brand || '').toLowerCase().includes(q) ||
      (o.model || '').toLowerCase().includes(q);
    const matchesStatus = status ? o.status === status : true;
    return matchesSearch && matchesStatus;
  });
  tbody.innerHTML = filtered.length
    ? filtered.map(o => `
        <tr>
          <td>#${o.id}</td>
          <td>${formatDate(o.created_at)}</td>
          <td>${o.client_name || 'Não informado'}</td>
          <td>${o.device_type} ${o.brand || ''} ${o.model || ''}</td>
          <td>${o.problem || '-'}</td>
          <td>${o.technician || '-'}</td>
          <td><span class="${badgeClass(o.status)}">${o.status}</span></td>
          <td class="actions">
            <button class="btn" onclick="editServiceOrder(${o.id})">Atualizar</button>
            <button class="btn btn-danger" onclick="deleteServiceOrder(${o.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="8" class="empty">Nenhuma ordem de serviço encontrada</td></tr>';
}

function openOsModal(os = null, budget = null) {
  document.getElementById('os-modal-title').textContent = os ? `Atualizar OS #${os.id}` : 'Nova Ordem de Serviço';
  document.getElementById('os-id').value = os ? os.id : '';
  document.getElementById('os-budget-id').value = os ? os.budget_id : (budget ? budget.id : '');
  document.getElementById('os-display').value = budget
    ? `${budget.client_name || 'Cliente'} - ${budget.device_type} ${budget.brand || ''} ${budget.model || ''}`
    : (os ? `OS #${os.id}` : '');
  document.getElementById('os-technician').value = os ? os.technician || '' : '';
  document.getElementById('os-status').value = os ? os.status : 'Recebido';
  document.getElementById('os-notes').value = os ? os.notes || '' : '';
  document.getElementById('os-modal').classList.add('open');
}

function closeOsModal() {
  document.getElementById('os-modal').classList.remove('open');
}

async function saveServiceOrder(e) {
  e.preventDefault();
  const id = document.getElementById('os-id').value;
  const body = {
    budget_id: document.getElementById('os-budget-id').value,
    technician: document.getElementById('os-technician').value,
    status: document.getElementById('os-status').value,
    notes: document.getElementById('os-notes').value
  };
  if (id) await api(`/api/service-orders/${id}`, { method: 'PUT', body });
  else await api('/api/service-orders', { method: 'POST', body });
  closeOsModal();
  await loadServiceOrders();
}

async function editServiceOrder(id) {
  const o = osCache.find(x => x.id === id);
  if (o) openOsModal(o, o);
}

async function deleteServiceOrder(id) {
  if (!confirm('Excluir ordem de serviço?')) return;
  await api(`/api/service-orders/${id}`, { method: 'DELETE' });
  await loadServiceOrders();
}

window.onclick = function(e) {
  if (e.target.classList.contains('modal')) e.target.classList.remove('open');
};

window.openClientModal = openClientModal;
window.closeClientModal = closeClientModal;
window.saveClient = saveClient;
window.editClient = editClient;
window.deleteClient = deleteClient;

window.openBudgetModal = openBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.saveBudget = saveBudget;
window.editBudget = editBudget;
window.deleteBudget = deleteBudget;
window.printBudget = printBudget;

window.downloadPdf = downloadPdf;
window.sendPdfEmail = sendPdfEmail;
window.calculateFinalValue = calculateFinalValue;

window.openOsModal = openOsModal;
window.closeOsModal = closeOsModal;
window.saveServiceOrder = saveServiceOrder;
window.editServiceOrder = editServiceOrder;
window.deleteServiceOrder = deleteServiceOrder;

// APPOINTMENTS
let appointmentsCache = [];
let budgetsForSelect = [];

async function loadAppointments() {
  appointmentsCache = await api('/api/appointments');
  renderAppointments();
}

async function loadBudgetsIntoSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  budgetsForSelect = await api('/api/budgets');
  select.innerHTML = '<option value="">Selecione um orçamento</option>' +
    budgetsForSelect.map(b => `<option value="${b.id}">#${b.id} - ${b.client_name || 'Cliente'} - ${b.device_type} ${b.brand || ''} ${b.model || ''}</option>`).join('');
}

function renderAppointments() {
  const q = document.getElementById('search-appointment')?.value.toLowerCase() || '';
  const status = document.getElementById('filter-appointment-status')?.value || '';
  const tbody = document.getElementById('appointments-table');
  const filtered = appointmentsCache.filter(a => {
    const matchesSearch =
      (a.client_name || '').toLowerCase().includes(q) ||
      (a.device_type || '').toLowerCase().includes(q) ||
      (a.brand || '').toLowerCase().includes(q) ||
      (a.model || '').toLowerCase().includes(q) ||
      (a.problem || '').toLowerCase().includes(q);
    const matchesStatus = status ? a.status === status : true;
    return matchesSearch && matchesStatus;
  });
  tbody.innerHTML = filtered.length
    ? filtered.map(a => `
        <tr>
          <td>#${a.id}</td>
          <td>${formatDateTime(a.appointment_date)}</td>
          <td>${a.client_name || 'Não informado'}</td>
          <td>${a.device_type} ${a.brand || ''} ${a.model || ''}</td>
          <td>${a.problem || '-'}</td>
          <td>${a.reminder ? 'Sim' : 'Não'}</td>
          <td><span class="${badgeClass(a.status)}">${a.status}</span></td>
          <td class="actions">
            <button class="btn" onclick="editAppointment(${a.id})">Editar</button>
            <button class="btn btn-danger" onclick="deleteAppointment(${a.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="8" class="empty">Nenhum agendamento encontrado</td></tr>';
}

function formatDateTime(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString('pt-BR');
}

function openAppointmentModal(appointment = null, budgetId = null) {
  document.getElementById('appointment-modal-title').textContent = appointment ? 'Editar Agendamento' : 'Novo Agendamento';
  document.getElementById('appointment-id').value = appointment ? appointment.id : '';
  const budgetSelect = document.getElementById('appointment-budget');
  const budgetIdValue = appointment ? appointment.budget_id : (budgetId || '');
  budgetSelect.value = budgetIdValue;
  document.getElementById('appointment-budget-id').value = budgetIdValue;
  if (appointment?.appointment_date) {
    const d = new Date(appointment.appointment_date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('appointment-date').value = d.toISOString().slice(0, 16);
  } else {
    document.getElementById('appointment-date').value = '';
  }
  document.getElementById('appointment-status').value = appointment ? appointment.status : 'Agendado';
  document.getElementById('appointment-reminder').checked = appointment ? appointment.reminder : false;
  document.getElementById('appointment-notes').value = appointment ? appointment.notes || '' : '';
  document.getElementById('appointment-modal').classList.add('open');
}

function openAppointmentModalFromBudget(budgetId) {
  openAppointmentModal(null, budgetId);
}

function closeAppointmentModal() {
  document.getElementById('appointment-modal').classList.remove('open');
}

async function saveAppointment(e) {
  e.preventDefault();
  const id = document.getElementById('appointment-id').value;
  const body = {
    budget_id: document.getElementById('appointment-budget-id').value,
    appointment_date: document.getElementById('appointment-date').value,
    reminder: document.getElementById('appointment-reminder').checked,
    status: document.getElementById('appointment-status').value,
    notes: document.getElementById('appointment-notes').value
  };
  if (!body.budget_id) return alert('Selecione um orçamento.');
  if (id) await api(`/api/appointments/${id}`, { method: 'PUT', body });
  else await api('/api/appointments', { method: 'POST', body });
  closeAppointmentModal();
  await loadAppointments();
}

async function editAppointment(id) {
  const a = appointmentsCache.find(x => x.id === id);
  if (a) openAppointmentModal(a);
}

async function deleteAppointment(id) {
  if (!confirm('Excluir agendamento?')) return;
  await api(`/api/appointments/${id}`, { method: 'DELETE' });
  await loadAppointments();
}

window.openAppointmentModal = openAppointmentModal;
window.closeAppointmentModal = closeAppointmentModal;
window.openAppointmentModalFromBudget = openAppointmentModalFromBudget;
window.saveAppointment = saveAppointment;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.loadAppointments = loadAppointments;
window.loadBudgetsIntoSelect = loadBudgetsIntoSelect;

window.loadDashboard = loadDashboard;
window.loadBudgets = loadBudgets;
window.loadClients = loadClients;
window.loadServiceOrders = loadServiceOrders;

async function downloadWarranty(id) {
  window.open(`/api/budgets/${id}/warranty`, '_blank');
}

async function sendWarrantyEmail(id) {
  try {
    const res = await fetch(`/api/budgets/${id}/send-warranty`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok && data.configured === false) {
      if (confirm(data.message + ' Deseja baixar a garantia agora?')) downloadWarranty(id);
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar garantia');
    alert(data.message);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function generateMonthlyReport() {
  const year = document.getElementById('report-year').value;
  const month = document.getElementById('report-month').value;
  if (!year || !month) return alert('Selecione ano e mês.');
  try {
    const data = await api(`/api/reports/monthly/${year}/${month}`);
    document.getElementById('report-result').style.display = 'block';
    document.getElementById('report-total').textContent = data.totalBudgets;
    document.getElementById('report-revenue').textContent = money(data.totalRevenue);
    document.getElementById('report-parts').textContent = money(data.totalParts);
    document.getElementById('report-extra').textContent = money(data.totalExtra);
    document.getElementById('report-profit').textContent = money(data.estimatedProfit);
    document.getElementById('report-status').innerHTML = Object.entries(data.byStatus).map(([k, v]) => `<div>${k}: ${v}</div>`).join('');
    document.getElementById('report-device').innerHTML = Object.entries(data.byDevice).map(([k, v]) => `<div>${k}: ${v}</div>`).join('');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

function downloadMonthlyReport() {
  const year = document.getElementById('report-year').value;
  const month = document.getElementById('report-month').value;
  if (!year || !month) return alert('Selecione ano e mês.');
  window.open(`/api/reports/monthly/${year}/${month}/pdf`, '_blank');
}

async function sendMonthlyReport() {
  const year = document.getElementById('report-year').value;
  const month = document.getElementById('report-month').value;
  const to = document.getElementById('report-email').value;
  if (!year || !month || !to) return alert('Preencha ano, mês e e-mail.');
  try {
    const res = await fetch(`/api/reports/monthly/${year}/${month}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar relatório');
    alert(data.message);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

window.downloadWarranty = downloadWarranty;
window.sendWarrantyEmail = sendWarrantyEmail;
window.generateMonthlyReport = generateMonthlyReport;
window.downloadMonthlyReport = downloadMonthlyReport;
window.sendMonthlyReport = sendMonthlyReport;

// CASH IN
let cashInCache = [];
let cashInChart = null;

async function loadCashIn() {
  const month = document.getElementById('filter-in-month')?.value;
  const year = document.getElementById('filter-in-year')?.value;
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (year) params.set('year', year);
  cashInCache = await api(`/api/cash-in?${params.toString()}`);
  renderCashIn();
  loadCashInReport(year, month);
}

function renderCashIn() {
  const tbody = document.getElementById('cash-in-table');
  if (!tbody) return;
  tbody.innerHTML = cashInCache.length
    ? cashInCache.map(item => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td>${item.type || 'Serviço'}</td>
          <td>${money(item.sale_value)}</td>
          <td>${money(item.cost)}</td>
          <td>${money(item.profit)}</td>
          <td class="actions">
            <button class="btn" onclick="editCashIn(${item.id})">Editar</button>
            <button class="btn btn-danger" onclick="deleteCashIn(${item.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="7" class="empty">Nenhuma entrada encontrada</td></tr>';
}

function calcCashInProfit() {
  const sale = parseFloat(document.getElementById('cash-in-sale')?.value) || 0;
  const cost = parseFloat(document.getElementById('cash-in-cost')?.value) || 0;
  const el = document.getElementById('cash-in-profit');
  if (el) el.value = money(sale - cost).replace('R$ ', '');
}

function openCashInModal(item = null) {
  document.getElementById('cash-in-modal-title').textContent = item ? 'Editar Entrada' : 'Nova Entrada';
  document.getElementById('cash-in-id').value = item ? item.id : '';
  document.getElementById('cash-in-date').value = item ? item.date : new Date().toISOString().split('T')[0];
  document.getElementById('cash-in-type').value = item ? item.type || 'Serviço' : 'Serviço';
  document.getElementById('cash-in-description').value = item ? item.description : '';
  document.getElementById('cash-in-sale').value = item ? item.sale_value || '' : '';
  document.getElementById('cash-in-cost').value = item ? item.cost || '' : '';
  calcCashInProfit();
  document.getElementById('cash-in-modal').classList.add('open');
}

function closeCashInModal() {
  document.getElementById('cash-in-modal').classList.remove('open');
}

async function saveCashIn(e) {
  e.preventDefault();
  const id = document.getElementById('cash-in-id').value;
  const body = {
    date: document.getElementById('cash-in-date').value,
    type: document.getElementById('cash-in-type').value,
    description: document.getElementById('cash-in-description').value,
    sale_value: parseFloat(document.getElementById('cash-in-sale').value) || 0,
    cost: parseFloat(document.getElementById('cash-in-cost').value) || 0
  };
  if (id) await api(`/api/cash-in/${id}`, { method: 'PUT', body });
  else await api('/api/cash-in', { method: 'POST', body });
  closeCashInModal();
  await loadCashIn();
}

async function editCashIn(id) {
  const item = cashInCache.find(x => x.id === id);
  if (item) openCashInModal(item);
}

async function deleteCashIn(id) {
  if (!confirm('Excluir entrada?')) return;
  await api(`/api/cash-in/${id}`, { method: 'DELETE' });
  await loadCashIn();
}

async function loadCashInReport(year, month) {
  if (!year || !month) return;
  try {
    const data = await api(`/api/cash-in/report/${year}/${month}`);
    document.getElementById('in-total-sales').textContent = money(data.totalSales);
    document.getElementById('in-total-cost').textContent = money(data.totalCost);
    document.getElementById('in-total-profit').textContent = money(data.totalProfit);
    const labels = Object.keys(data.byDay).sort();
    const values = labels.map(d => data.byDay[d]);
    renderChart('cashInChart', `Entradas - ${month}/${year}`, labels.map(d => d.slice(8)), values, '#22c55e', cashInChart, c => { cashInChart = c; });
  } catch (e) { console.error(e); }
}

// CASH OUT
let cashOutCache = [];
let cashOutChart = null;

async function loadCashOut() {
  const month = document.getElementById('filter-out-month')?.value;
  const year = document.getElementById('filter-out-year')?.value;
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (year) params.set('year', year);
  cashOutCache = await api(`/api/cash-out?${params.toString()}`);
  renderCashOut();
  loadCashOutReport(year, month);
}

function renderCashOut() {
  const tbody = document.getElementById('cash-out-table');
  if (!tbody) return;
  tbody.innerHTML = cashOutCache.length
    ? cashOutCache.map(item => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${item.description || '-'}</td>
          <td>${money(item.amount)}</td>
          <td><span class="${item.paid ? 'badge badge-concluido' : 'badge badge-pendente'}">${item.paid ? 'Pago' : 'Não Pago'}</span></td>
          <td class="actions">
            <button class="btn" onclick="editCashOut(${item.id})">Editar</button>
            <button class="btn btn-danger" onclick="deleteCashOut(${item.id})">Excluir</button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty">Nenhuma saída encontrada</td></tr>';
}

function openCashOutModal(item = null) {
  document.getElementById('cash-out-modal-title').textContent = item ? 'Editar Saída' : 'Nova Saída';
  document.getElementById('cash-out-id').value = item ? item.id : '';
  document.getElementById('cash-out-date').value = item ? item.date : new Date().toISOString().split('T')[0];
  document.getElementById('cash-out-description').value = item ? item.description : '';
  document.getElementById('cash-out-amount').value = item ? item.amount || '' : '';
  document.getElementById('cash-out-paid').checked = item ? item.paid : true;
  document.getElementById('cash-out-modal').classList.add('open');
}

function closeCashOutModal() {
  document.getElementById('cash-out-modal').classList.remove('open');
}

async function saveCashOut(e) {
  e.preventDefault();
  const id = document.getElementById('cash-out-id').value;
  const body = {
    date: document.getElementById('cash-out-date').value,
    description: document.getElementById('cash-out-description').value,
    amount: parseFloat(document.getElementById('cash-out-amount').value) || 0,
    paid: document.getElementById('cash-out-paid').checked
  };
  if (id) await api(`/api/cash-out/${id}`, { method: 'PUT', body });
  else await api('/api/cash-out', { method: 'POST', body });
  closeCashOutModal();
  await loadCashOut();
}

async function editCashOut(id) {
  const item = cashOutCache.find(x => x.id === id);
  if (item) openCashOutModal(item);
}

async function deleteCashOut(id) {
  if (!confirm('Excluir saída?')) return;
  await api(`/api/cash-out/${id}`, { method: 'DELETE' });
  await loadCashOut();
}

async function loadCashOutReport(year, month) {
  if (!year || !month) return;
  try {
    const data = await api(`/api/cash-out/report/${year}/${month}`);
    document.getElementById('out-total').textContent = money(data.total);
    document.getElementById('out-paid').textContent = money(data.totalPaid);
    document.getElementById('out-unpaid').textContent = money(data.totalUnpaid);
    const labels = Object.keys(data.byDay).sort();
    const values = labels.map(d => data.byDay[d]);
    renderChart('cashOutChart', `Saídas - ${month}/${year}`, labels.map(d => d.slice(8)), values, '#ef4444', cashOutChart, c => { cashOutChart = c; });
  } catch (e) { console.error(e); }
}

// CHARTS
function renderChart(canvasId, label, labels, data, color, oldChart, setter) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  if (oldChart) oldChart.destroy();
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: color,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  setter(chart);
}

// REPORTS PAGE CHARTS
let reportBudgetChart = null;
let reportCashInChart = null;
let reportCashOutChart = null;

async function generateMonthlyReport() {
  const year = document.getElementById('report-year').value;
  const month = document.getElementById('report-month').value;
  if (!year || !month) return alert('Selecione ano e mês.');
  try {
    const data = await api(`/api/reports/monthly/${year}/${month}`);
    document.getElementById('report-result').style.display = 'block';
    document.getElementById('report-total').textContent = data.totalBudgets;
    document.getElementById('report-revenue').textContent = money(data.totalRevenue);
    document.getElementById('report-parts').textContent = money(data.totalParts);
    document.getElementById('report-extra').textContent = money(data.totalExtra);
    document.getElementById('report-profit').textContent = money(data.estimatedProfit);
    document.getElementById('report-status').innerHTML = Object.entries(data.byStatus).map(([k, v]) => `<div>${k}: ${v}</div>`).join('');
    document.getElementById('report-device').innerHTML = Object.entries(data.byDevice).map(([k, v]) => `<div>${k}: ${v}</div>`).join('');

    renderChart('report-budget-chart', 'Orçamentos por Status', Object.keys(data.byStatus), Object.values(data.byStatus), '#3b82f6', reportBudgetChart, c => { reportBudgetChart = c; });

    const cin = await api(`/api/cash-in/report/${year}/${month}`);
    renderChart('report-cashin-chart', 'Entradas por Dia', Object.keys(cin.byDay).sort().map(d => d.slice(8)), Object.keys(cin.byDay).sort().map(d => cin.byDay[d]), '#22c55e', reportCashInChart, c => { reportCashInChart = c; });

    const cout = await api(`/api/cash-out/report/${year}/${month}`);
    renderChart('report-cashout-chart', 'Saídas por Dia', Object.keys(cout.byDay).sort().map(d => d.slice(8)), Object.keys(cout.byDay).sort().map(d => cout.byDay[d]), '#ef4444', reportCashOutChart, c => { reportCashOutChart = c; });
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

window.openCashInModal = openCashInModal;
window.closeCashInModal = closeCashInModal;
window.saveCashIn = saveCashIn;
window.editCashIn = editCashIn;
window.deleteCashIn = deleteCashIn;
window.loadCashIn = loadCashIn;
window.calcCashInProfit = calcCashInProfit;

window.openCashOutModal = openCashOutModal;
window.closeCashOutModal = closeCashOutModal;
window.saveCashOut = saveCashOut;
window.editCashOut = editCashOut;
window.deleteCashOut = deleteCashOut;
window.loadCashOut = loadCashOut;
