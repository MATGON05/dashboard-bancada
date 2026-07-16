require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'suittech.db');
const ORC_DIR = path.join(__dirname, 'orcamentos');
const REL_DIR = path.join(__dirname, 'relatorios');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORC_DIR)) fs.mkdirSync(ORC_DIR, { recursive: true });
if (!fs.existsSync(REL_DIR)) fs.mkdirSync(REL_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function columnExists(table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.some(r => r.name === column));
    });
  });
}

async function migrate() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      cpf TEXT,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      device_type TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial TEXT,
      problem TEXT,
      diagnosis TEXT,
      value REAL DEFAULT 0,
      parts_cost REAL DEFAULT 0,
      extra_cost REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      financial_notes TEXT,
      status TEXT DEFAULT 'Pendente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER,
      technician TEXT,
      status TEXT DEFAULT 'Recebido',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    )`,
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER,
      appointment_date TEXT NOT NULL,
      reminder INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Agendado',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    )`,
    `CREATE TABLE IF NOT EXISTS cash_in (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'Serviço',
      sale_value REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      profit REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cash_out (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT,
      amount REAL DEFAULT 0,
      paid INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    await run(sql);
  }

  const financeColumns = [
    { name: 'parts_cost', type: 'REAL DEFAULT 0' },
    { name: 'extra_cost', type: 'REAL DEFAULT 0' },
    { name: 'profit_margin', type: 'REAL DEFAULT 0' },
    { name: 'financial_notes', type: 'TEXT' },
    { name: 'final_value', type: 'REAL DEFAULT 0' }
  ];
  for (const col of financeColumns) {
    const exists = await columnExists('budgets', col.name);
    if (!exists) {
      await run(`ALTER TABLE budgets ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

db.serialize(() => migrate().catch(err => console.error('Erro na migração:', err)));

app.use(express.json());
app.use('/orcamentos', express.static(ORC_DIR));
app.use(express.static(path.join(__dirname, 'public')));

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

// CLIENTS
app.get('/api/clients', async (req, res) => {
  try { res.json(await all('SELECT * FROM clients ORDER BY name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients', async (req, res) => {
  const { name, phone, email, cpf, address } = req.body;
  try {
    const info = await run('INSERT INTO clients (name, phone, email, cpf, address) VALUES (?, ?, ?, ?, ?)', [name, phone, email, cpf, address]);
    res.json({ id: info.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
  const { name, phone, email, cpf, address } = req.body;
  try {
    await run('UPDATE clients SET name=?, phone=?, email=?, cpf=?, address=? WHERE id=?', [name, phone, email, cpf, address, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await run('DELETE FROM clients WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUDGETS
app.get('/api/budgets', async (req, res) => {
  try {
    const rows = await all(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/budgets/:id', async (req, res) => {
  try {
    const budget = await get(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.cpf AS client_cpf, c.address AS client_address
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });
    const os = await all('SELECT * FROM service_orders WHERE budget_id = ? ORDER BY created_at DESC', [req.params.id]);
    const appointments = await all('SELECT * FROM appointments WHERE budget_id = ? ORDER BY appointment_date ASC', [req.params.id]);
    res.json({ ...budget, service_orders: os, appointments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budgets', async (req, res) => {
  const { client_id, device_type, brand, model, serial, problem, diagnosis, value, parts_cost, extra_cost, profit_margin, financial_notes, status } = req.body;
  const v = value || 0;
  const p = parts_cost || 0;
  const e = extra_cost || 0;
  const m = profit_margin || 0;
  const final_value = v + p + e + ((v + p + e) * (m / 100));
  try {
    const info = await run(`
      INSERT INTO budgets (client_id, device_type, brand, model, serial, problem, diagnosis, value, parts_cost, extra_cost, profit_margin, financial_notes, status, final_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [client_id, device_type, brand, model, serial, problem, diagnosis, v, p, e, m, financial_notes || '', status || 'Pendente', final_value]);
    res.json({ id: info.id, final_value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/budgets/:id', async (req, res) => {
  const { client_id, device_type, brand, model, serial, problem, diagnosis, value, parts_cost, extra_cost, profit_margin, financial_notes, status } = req.body;
  const v = value || 0;
  const p = parts_cost || 0;
  const e = extra_cost || 0;
  const m = profit_margin || 0;
  const final_value = v + p + e + ((v + p + e) * (m / 100));
  try {
    await run(`
      UPDATE budgets SET client_id=?, device_type=?, brand=?, model=?, serial=?, problem=?, diagnosis=?, value=?, parts_cost=?, extra_cost=?, profit_margin=?, financial_notes=?, status=?, final_value=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [client_id, device_type, brand, model, serial, problem, diagnosis, v, p, e, m, financial_notes || '', status, final_value, req.params.id]);
    res.json({ ok: true, final_value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/budgets/:id', async (req, res) => {
  try {
    await run('DELETE FROM appointments WHERE budget_id=?', [req.params.id]);
    await run('DELETE FROM service_orders WHERE budget_id=?', [req.params.id]);
    await run('DELETE FROM budgets WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// APPOINTMENTS
app.get('/api/appointments', async (req, res) => {
  try {
    const rows = await all(`
      SELECT a.*, b.device_type, b.brand, b.model, b.problem, c.name AS client_name, c.phone AS client_phone
      FROM appointments a
      JOIN budgets b ON a.budget_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY a.appointment_date ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/appointments', async (req, res) => {
  const { budget_id, appointment_date, reminder, status, notes } = req.body;
  try {
    const info = await run('INSERT INTO appointments (budget_id, appointment_date, reminder, status, notes) VALUES (?, ?, ?, ?, ?)', [budget_id, appointment_date, reminder ? 1 : 0, status || 'Agendado', notes]);
    res.json({ id: info.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/appointments/:id', async (req, res) => {
  const { appointment_date, reminder, status, notes } = req.body;
  try {
    await run('UPDATE appointments SET appointment_date=?, reminder=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [appointment_date, reminder ? 1 : 0, status, notes, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    await run('DELETE FROM appointments WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CASH IN
app.get('/api/cash-in', async (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM cash_in';
    let params = [];
    if (month && year) {
      sql += ' WHERE date LIKE ?';
      params.push(`${year}-${String(month).padStart(2, '0')}%`);
    }
    sql += ' ORDER BY date DESC';
    res.json(await all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cash-in', async (req, res) => {
  const { date, description, type, sale_value, cost } = req.body;
  const profit = (sale_value || 0) - (cost || 0);
  try {
    const info = await run('INSERT INTO cash_in (date, description, type, sale_value, cost, profit) VALUES (?, ?, ?, ?, ?, ?)', [date, description, type || 'Serviço', sale_value || 0, cost || 0, profit]);
    res.json({ id: info.id, profit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cash-in/:id', async (req, res) => {
  const { date, description, type, sale_value, cost } = req.body;
  const profit = (sale_value || 0) - (cost || 0);
  try {
    await run('UPDATE cash_in SET date=?, description=?, type=?, sale_value=?, cost=?, profit=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [date, description, type, sale_value || 0, cost || 0, profit, req.params.id]);
    res.json({ ok: true, profit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cash-in/:id', async (req, res) => {
  try {
    await run('DELETE FROM cash_in WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cash-in/report/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const like = `${year}-${String(month).padStart(2, '0')}%`;
    const rows = await all('SELECT * FROM cash_in WHERE date LIKE ? ORDER BY date ASC', [like]);
    const totalSales = rows.reduce((a, b) => a + Number(b.sale_value || 0), 0);
    const totalCost = rows.reduce((a, b) => a + Number(b.cost || 0), 0);
    const totalProfit = rows.reduce((a, b) => a + Number(b.profit || 0), 0);
    const byType = {};
    rows.forEach(r => { byType[r.type] = (byType[r.type] || 0) + Number(r.sale_value || 0); });
    const byDay = {};
    rows.forEach(r => { byDay[r.date] = (byDay[r.date] || 0) + Number(r.sale_value || 0); });
    res.json({ year, month, rows, totalSales, totalCost, totalProfit, byType, byDay });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CASH OUT
app.get('/api/cash-out', async (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM cash_out';
    let params = [];
    if (month && year) {
      sql += ' WHERE date LIKE ?';
      params.push(`${year}-${String(month).padStart(2, '0')}%`);
    }
    sql += ' ORDER BY date DESC';
    res.json(await all(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cash-out', async (req, res) => {
  const { date, description, amount, paid } = req.body;
  try {
    const info = await run('INSERT INTO cash_out (date, description, amount, paid) VALUES (?, ?, ?, ?)', [date, description, amount || 0, paid ? 1 : 0]);
    res.json({ id: info.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cash-out/:id', async (req, res) => {
  const { date, description, amount, paid } = req.body;
  try {
    await run('UPDATE cash_out SET date=?, description=?, amount=?, paid=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [date, description, amount || 0, paid ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cash-out/:id', async (req, res) => {
  try {
    await run('DELETE FROM cash_out WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cash-out/report/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const like = `${year}-${String(month).padStart(2, '0')}%`;
    const rows = await all('SELECT * FROM cash_out WHERE date LIKE ? ORDER BY date ASC', [like]);
    const total = rows.reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalPaid = rows.filter(r => r.paid).reduce((a, b) => a + Number(b.amount || 0), 0);
    const totalUnpaid = total - totalPaid;
    const byDay = {};
    rows.forEach(r => { byDay[r.date] = (byDay[r.date] || 0) + Number(r.amount || 0); });
    res.json({ year, month, rows, total, totalPaid, totalUnpaid, byDay });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SERVICE ORDERS
app.get('/api/service-orders', async (req, res) => {
  try {
    const rows = await all(`
      SELECT so.*, b.device_type, b.brand, b.model, b.problem, c.name AS client_name
      FROM service_orders so
      JOIN budgets b ON so.budget_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY so.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/service-orders', async (req, res) => {
  const { budget_id, technician, status, notes } = req.body;
  try {
    const info = await run('INSERT INTO service_orders (budget_id, technician, status, notes) VALUES (?, ?, ?, ?)', [budget_id, technician, status, notes]);
    await run('UPDATE budgets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, budget_id]);
    res.json({ id: info.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/service-orders/:id', async (req, res) => {
  const { technician, status, notes } = req.body;
  try {
    await run('UPDATE service_orders SET technician=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [technician, status, notes, req.params.id]);
    const so = await get('SELECT budget_id FROM service_orders WHERE id=?', [req.params.id]);
    if (so) await run('UPDATE budgets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, so.budget_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/service-orders/:id', async (req, res) => {
  try {
    await run('DELETE FROM service_orders WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DASHBOARD
app.get('/api/dashboard', async (req, res) => {
  try {
    const totals = await get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Pendente' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'Aprovado' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'Entregue' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'Cancelado' THEN 1 ELSE 0 END) AS cancelled,
        SUM(final_value) AS revenue
      FROM budgets
    `);
    const recent = await all(`
      SELECT b.*, c.name AS client_name
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);
    const osByStatus = await all(`
      SELECT status, COUNT(*) AS count
      FROM service_orders
      GROUP BY status
    `);
    res.json({ totals, recent, osByStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const company = {
  name: 'SUIT-TECH',
  phone: '24999421921'
};

function calcTotals(b) {
  const service = Number(b.value || 0);
  const parts = Number(b.parts_cost || 0);
  const extra = Number(b.extra_cost || 0);
  const margin = Number(b.profit_margin || 0);
  const subtotal = service + parts + extra;
  const profit = subtotal * (margin / 100);
  const total = subtotal + profit;
  return { service, parts, extra, margin, profit, total };
}

function headerWithLogo(doc) {
  const logoPath = path.join(__dirname, 'public', 'logo.png');
  const hasLogo = fs.existsSync(logoPath);
  if (hasLogo) {
    doc.image(logoPath, 50, 40, { width: 60 });
  }
  doc.fillColor('#3b82f6').fontSize(22).text(company.name, hasLogo ? 120 : 50, 45);
  doc.fillColor('#555').fontSize(10);
  doc.text(`Tel: ${company.phone}`, hasLogo ? 120 : 50, 70);
  doc.moveTo(50, 95).lineTo(550, 95).stroke('#3b82f6');
}

function buildBudgetPdf(b, doc) {
  const t = calcTotals(b);
  headerWithLogo(doc);

  doc.fillColor('#3b82f6').fontSize(13).text('ORÇAMENTO DE SERVIÇO', 50, 110);
  doc.fillColor('#555').fontSize(9);
  doc.text(`Número: #${b.id} | Data: ${new Date(b.created_at).toLocaleDateString('pt-BR')} | Status: ${b.status || 'Pendente'}`, 50, 128);

  doc.fillColor('#3b82f6').fontSize(11).text('CLIENTE', 50, 150);
  doc.fillColor('#333').fontSize(9);
  doc.text(`${b.client_name || 'Não informado'} | Tel: ${b.client_phone || '-'} | E-mail: ${b.client_email || '-'}`, 50, 165);
  doc.text(`CPF: ${b.client_cpf || '-'} | Endereço: ${b.client_address || '-'}`, 50, 178);

  doc.fillColor('#3b82f6').fontSize(11).text('APARELHO', 50, 200);
  doc.fillColor('#333').fontSize(9);
  doc.text(`${b.device_type || '-'} ${(b.brand || '')} ${(b.model || '')}`.trim() + ` | Série: ${b.serial || '-'}`, 50, 215);

  doc.fillColor('#3b82f6').fontSize(11).text('DEFEITO E DIAGNÓSTICO', 50, 235);
  doc.fillColor('#333').fontSize(9);
  doc.text(`Defeito: ${b.problem || '-'}`, 50, 250);
  doc.text(`Diagnóstico: ${b.diagnosis || '-'}`, 50, 263);

  doc.fillColor('#3b82f6').fontSize(11).text('VALOR DO ORÇAMENTO', 50, 290);
  doc.fillColor('#333').fontSize(10);
  doc.text('Total a pagar:', 50, 308);
  doc.fillColor('#3b82f6').fontSize(22).text(`R$ ${t.total.toFixed(2).replace('.', ',')}`, 50, 325);

  doc.moveTo(50, 380).lineTo(550, 380).stroke('#ccc');

  doc.fillColor('#555').fontSize(8);
  doc.text('TERMOS E CONDIÇÕES:', 50, 390);
  doc.text('1. O orçamento tem validade de 30 dias. 2. A garantia do serviço é de 90 dias.', 50, 403);
  doc.text('3. Peças substituídas têm garantia conforme fabricante.', 50, 416);
  doc.text('4. O não comparecimento na data agendada poderá gerar nova taxa de análise.', 50, 429);

  doc.fillColor('#333').fontSize(9);
  doc.text('_'.repeat(45), 50, 465);
  doc.text('Assinatura do Cliente', 50, 478);
  doc.text('_'.repeat(45), 320, 465);
  doc.text('Assinatura do Técnico', 320, 478);
}

function buildWarrantyPdf(b, doc) {
  headerWithLogo(doc);
  const warrantyDays = 90;
  const deliveryDate = new Date();
  const warrantyUntil = new Date(deliveryDate);
  warrantyUntil.setDate(warrantyUntil.getDate() + warrantyDays);

  doc.fillColor('#3b82f6').fontSize(13).text('TERMO DE GARANTIA', 50, 110);
  doc.fillColor('#555').fontSize(9);
  doc.text(`Número: #${b.id} | Data de entrega: ${deliveryDate.toLocaleDateString('pt-BR')} | Garantia até: ${warrantyUntil.toLocaleDateString('pt-BR')}`, 50, 128);

  doc.fillColor('#3b82f6').fontSize(11).text('CLIENTE', 50, 150);
  doc.fillColor('#333').fontSize(9);
  doc.text(`${b.client_name || 'Não informado'} | Tel: ${b.client_phone || '-'} | E-mail: ${b.client_email || '-'}`, 50, 165);
  doc.text(`CPF: ${b.client_cpf || '-'}`, 50, 178);

  doc.fillColor('#3b82f6').fontSize(11).text('APARELHO', 50, 200);
  doc.fillColor('#333').fontSize(9);
  doc.text(`${b.device_type || '-'} ${(b.brand || '')} ${(b.model || '')}`.trim() + ` | Série: ${b.serial || '-'}`, 50, 215);

  doc.fillColor('#3b82f6').fontSize(11).text('SERVIÇO REALIZADO', 50, 235);
  doc.fillColor('#333').fontSize(9);
  doc.text(`Defeito: ${b.problem || '-'}`, 50, 250);
  doc.text(`Diagnóstico: ${b.diagnosis || '-'}`, 50, 263);

  doc.fillColor('#3b82f6').fontSize(11).text('TERMOS DE GARANTIA', 50, 290);
  doc.fillColor('#333').fontSize(9);
  doc.text('1. A garantia cobre exclusivamente o serviço executado e as peças substituídas.', 50, 307);
  doc.text('2. O prazo de garantia é de 90 (noventa) dias a partir da data de entrega.', 50, 322);
  doc.text('3. Não estão cobertos danos causados por mau uso, quedas, contato com líquidos ou desmontagem.', 50, 337);
  doc.text('4. Para acionar a garantia, apresente este documento e o aparelho.', 50, 352);
  doc.text('5. A garantia não cobre perda de dados do aparelho.', 50, 367);

  doc.fillColor('#333').fontSize(9);
  doc.text('_'.repeat(45), 50, 465);
  doc.text('Assinatura do Cliente', 50, 478);
  doc.text('_'.repeat(45), 320, 465);
  doc.text('Assinatura do Técnico', 320, 478);
}

function generatePdfToFile(builder, b, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    builder(b, doc);
    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  return nodemailer.createTransport({ host, port: parseInt(port), auth: { user, pass } });
}

async function sendEmailWithAttachment(to, subject, text, filePath) {
  const transporter = createTransporter();
  if (!transporter) throw new Error('SMTP não configurado. Configure o arquivo .env.');
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments: [{ filename: path.basename(filePath), path: filePath }]
  });
}

app.get('/api/budgets/:id/pdf', async (req, res) => {
  try {
    const b = await get(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.cpf AS client_cpf, c.address AS client_address
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const filePath = path.join(ORC_DIR, `orcamento-${b.id}.pdf`);
    await generatePdfToFile(buildBudgetPdf, b, filePath);
    res.download(filePath);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budgets/:id/send-email', async (req, res) => {
  try {
    const b = await get(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.cpf AS client_cpf, c.address AS client_address
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(400).json({ configured: false, message: 'SMTP não configurado. Configure o arquivo .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) ou baixe o PDF manualmente.' });
    }

    const to = b.client_email || req.body.to;
    if (!to) return res.status(400).json({ error: 'Cliente não possui e-mail cadastrado. Informe um e-mail temporário.' });

    const filePath = path.join(ORC_DIR, `orcamento-${b.id}.pdf`);
    await generatePdfToFile(buildBudgetPdf, b, filePath);
    await sendEmailWithAttachment(to, `Orçamento #${b.id} - SUIT-TECH`, `Olá ${b.client_name || 'Cliente'},\n\nSegue em anexo o orçamento #${b.id}.\n\nAtenciosamente,\nSUIT-TECH`, filePath);
    res.json({ ok: true, message: 'E-mail enviado com sucesso.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/budgets/:id/warranty', async (req, res) => {
  try {
    const b = await get(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.cpf AS client_cpf, c.address AS client_address
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Orçamento não encontrado' });
    const filePath = path.join(ORC_DIR, `garantia-${b.id}.pdf`);
    await generatePdfToFile(buildWarrantyPdf, b, filePath);
    res.download(filePath);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budgets/:id/send-warranty', async (req, res) => {
  try {
    const b = await get(`
      SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.cpf AS client_cpf, c.address AS client_address
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);
    if (!b) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(400).json({ configured: false, message: 'SMTP não configurado. Configure o arquivo .env para enviar a garantia por email.' });
    }

    const to = b.client_email || req.body.to;
    if (!to) return res.status(400).json({ error: 'Cliente não possui e-mail cadastrado.' });

    const filePath = path.join(ORC_DIR, `garantia-${b.id}.pdf`);
    await generatePdfToFile(buildWarrantyPdf, b, filePath);
    await sendEmailWithAttachment(to, `Garantia do Orçamento #${b.id} - SUIT-TECH`, `Olá ${b.client_name || 'Cliente'},\n\nSegue em anexo o termo de garantia do orçamento #${b.id}.\n\nAtenciosamente,\nSUIT-TECH`, filePath);
    res.json({ ok: true, message: 'Garantia enviada com sucesso.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MONTHLY REPORT
app.get('/api/reports/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const start = `${year}-${month.padStart(2, '0')}-01`;
    const end = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;

    const budgets = await all(`
      SELECT b.*, c.name AS client_name
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.created_at >= ? AND b.created_at < ?
      ORDER BY b.created_at DESC
    `, [start, end]);

    const appointments = await all(`
      SELECT a.*, c.name AS client_name, b.device_type, b.brand, b.model
      FROM appointments a
      JOIN budgets b ON a.budget_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE a.created_at >= ? AND a.created_at < ?
      ORDER BY a.appointment_date ASC
    `, [start, end]);

    const byStatus = {};
    const byDevice = {};
    let totalRevenue = 0;
    let totalParts = 0;
    let totalExtra = 0;
    let totalService = 0;

    for (const b of budgets) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      byDevice[b.device_type] = (byDevice[b.device_type] || 0) + 1;
      totalRevenue += Number(b.final_value || 0);
      totalParts += Number(b.parts_cost || 0);
      totalExtra += Number(b.extra_cost || 0);
      totalService += Number(b.value || 0);
    }

    res.json({
      year, month,
      totalBudgets: budgets.length,
      byStatus,
      byDevice,
      totalRevenue,
      totalParts,
      totalExtra,
      totalService,
      estimatedProfit: totalRevenue - totalParts - totalExtra - totalService,
      budgets,
      appointments
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/monthly/:year/:month/pdf', async (req, res) => {
  try {
    const { year, month } = req.params;
    const start = `${year}-${month.padStart(2, '0')}-01`;
    const end = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`;

    const budgets = await all(`
      SELECT b.*, c.name AS client_name
      FROM budgets b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.created_at >= ? AND b.created_at < ?
      ORDER BY b.created_at DESC
    `, [start, end]);

    const appointments = await all(`
      SELECT a.*, c.name AS client_name, b.device_type, b.brand, b.model
      FROM appointments a
      JOIN budgets b ON a.budget_id = b.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE a.created_at >= ? AND a.created_at < ?
      ORDER BY a.appointment_date ASC
    `, [start, end]);

    let totalRevenue = 0, totalParts = 0, totalExtra = 0, totalService = 0;
    const byStatus = {}, byDevice = {};
    for (const b of budgets) {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
      byDevice[b.device_type] = (byDevice[b.device_type] || 0) + 1;
      totalRevenue += Number(b.final_value || 0);
      totalParts += Number(b.parts_cost || 0);
      totalExtra += Number(b.extra_cost || 0);
      totalService += Number(b.value || 0);
    }
    const estimatedProfit = totalRevenue - totalParts - totalExtra - totalService;

    const filePath = path.join(REL_DIR, `relatorio-mensal-${year}-${month}.pdf`);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    headerWithLogo(doc);
    doc.fillColor('#3b82f6').fontSize(14).text(`RELATÓRIO MENSAL - ${month}/${year}`, 50, 125);

    doc.fillColor('#3b82f6').fontSize(11).text('RESUMO FINANCEIRO', 50, 155);
    doc.fillColor('#333').fontSize(9);
    doc.text(`Total de Orçamentos: ${budgets.length}`, 50, 172);
    doc.text(`Faturamento: R$ ${totalRevenue.toFixed(2).replace('.', ',')}`, 50, 187);
    doc.text(`Custos com Peças: R$ ${totalParts.toFixed(2).replace('.', ',')}`, 50, 202);
    doc.text(`Custos Extras: R$ ${totalExtra.toFixed(2).replace('.', ',')}`, 250, 202);
    doc.text(`Lucro Estimado: R$ ${estimatedProfit.toFixed(2).replace('.', ',')}`, 50, 217);

    doc.fillColor('#3b82f6').fontSize(11).text('ORÇAMENTOS POR STATUS', 50, 245);
    doc.fillColor('#333').fontSize(9);
    let y = 262;
    for (const [status, count] of Object.entries(byStatus)) {
      doc.text(`${status}: ${count}`, 50, y); y += 14;
    }

    doc.fillColor('#3b82f6').fontSize(11).text('ORÇAMENTOS POR APARELHO', 50, y + 10);
    doc.fillColor('#333').fontSize(9);
    y += 27;
    for (const [device, count] of Object.entries(byDevice)) {
      doc.text(`${device}: ${count}`, 50, y); y += 14;
    }

    doc.addPage();
    headerWithLogo(doc);
    doc.fillColor('#3b82f6').fontSize(14).text('LISTA DE ORÇAMENTOS', 50, 125);
    y = 150;
    for (const b of budgets) {
      if (y > 700) { doc.addPage(); headerWithLogo(doc); y = 125; }
      doc.fillColor('#333').fontSize(8);
      doc.text(`#${b.id} - ${b.client_name || 'N/I'} - ${b.device_type} ${b.brand || ''} ${b.model || ''} - R$ ${Number(b.final_value || 0).toFixed(2).replace('.', ',')} - ${b.status}`, 50, y);
      y += 14;
    }

    if (appointments.length) {
      doc.addPage();
      headerWithLogo(doc);
      doc.fillColor('#3b82f6').fontSize(14).text('AGENDAMENTOS', 50, 125);
      y = 150;
      for (const a of appointments) {
        if (y > 700) { doc.addPage(); headerWithLogo(doc); y = 125; }
        doc.fillColor('#333').fontSize(8);
        doc.text(`#${a.id} - ${a.client_name || 'N/I'} - ${a.device_type} ${a.brand || ''} ${a.model || ''} - ${new Date(a.appointment_date).toLocaleString('pt-BR')} - ${a.status}`, 50, y);
        y += 14;
      }
    }

    doc.end();
    stream.on('finish', () => res.download(filePath));
    stream.on('error', e => res.status(500).json({ error: e.message }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reports/monthly/:year/:month/send', async (req, res) => {
  try {
    const { year, month } = req.params;
    const to = req.body.to;
    if (!to) return res.status(400).json({ error: 'Informe o e-mail do destinatário.' });
    const filePath = path.join(REL_DIR, `relatorio-mensal-${year}-${month}.pdf`);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Gere o relatório PDF primeiro.' });
    }
    await sendEmailWithAttachment(to, `Relatório Mensal SUIT-TECH - ${month}/${year}`, `Segue em anexo o relatório mensal de ${month}/${year}.\n\nAtenciosamente,\nSUIT-TECH`, filePath);
    res.json({ ok: true, message: 'Relatório enviado com sucesso.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`SUIT-TECH rodando em http://localhost:${PORT}`);
});
