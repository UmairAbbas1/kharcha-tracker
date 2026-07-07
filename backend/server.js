import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// ── Database (lowdb JSON file) ────────────────────────────────────────────────
const dbFile = join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const defaultData = { expenses: [], nextId: 1 };
const db = new Low(adapter, defaultData);

await db.read();

// Seed if empty
if (db.data.expenses.length === 0) {
  const today = new Date();
  const d = (n) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - n);
    return dt.toISOString().split('T')[0];
  };
  db.data.expenses = [
    { id: 1, title: 'Chicken Biryani 🍛',  amount: 350,  category: 'Food',      date: d(0), created_at: new Date().toISOString() },
    { id: 2, title: 'Careem Ride 🚗',       amount: 220,  category: 'Transport', date: d(1), created_at: new Date().toISOString() },
    { id: 3, title: 'Hostel Rent 🏠',        amount: 8500, category: 'Rent',      date: d(2), created_at: new Date().toISOString() },
    { id: 4, title: 'Cinema Ticket 🎬',      amount: 650,  category: 'Fun',       date: d(3), created_at: new Date().toISOString() },
    { id: 5, title: 'Doodh Patti Chai ☕',  amount: 60,   category: 'Food',      date: d(4), created_at: new Date().toISOString() },
    { id: 6, title: 'Jazz Mobile Load 📱',  amount: 300,  category: 'Other',     date: d(5), created_at: new Date().toISOString() },
  ];
  db.data.nextId = 7;
  await db.write();
  console.log('✅ Sample data seeded');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_CATS = ['Food', 'Transport', 'Rent', 'Fun', 'Other'];

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/expenses
app.get('/api/expenses', async (_req, res) => {
  await db.read();
  const sorted = [...db.data.expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );
  res.json({ success: true, data: sorted });
});

// GET /api/expenses/:id
app.get('/api/expenses/:id', async (req, res) => {
  await db.read();
  const expense = db.data.expenses.find(e => e.id === Number(req.params.id));
  if (!expense) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: expense });
});

// POST /api/expenses
app.post('/api/expenses', async (req, res) => {
  const { title, amount, category, date } = req.body;

  if (!title?.trim())
    return res.status(400).json({ success: false, error: 'Title is required' });
  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
  if (!VALID_CATS.includes(category))
    return res.status(400).json({ success: false, error: `Category must be one of: ${VALID_CATS.join(', ')}` });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });

  await db.read();
  const newExpense = {
    id: db.data.nextId++,
    title: title.trim(),
    amount: Number(amount),
    category,
    date,
    created_at: new Date().toISOString(),
  };
  db.data.expenses.push(newExpense);
  await db.write();
  res.status(201).json({ success: true, data: newExpense });
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', async (req, res) => {
  await db.read();
  const idx = db.data.expenses.findIndex(e => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });

  const existing = db.data.expenses[idx];
  const { title, amount, category, date } = req.body;

  const updated = {
    ...existing,
    title:    title?.trim()    ?? existing.title,
    amount:   amount != null   ? Number(amount) : existing.amount,
    category: category         ?? existing.category,
    date:     date             ?? existing.date,
  };

  if (!VALID_CATS.includes(updated.category))
    return res.status(400).json({ success: false, error: 'Invalid category' });
  if (isNaN(updated.amount) || updated.amount <= 0)
    return res.status(400).json({ success: false, error: 'Amount must be positive' });

  db.data.expenses[idx] = updated;
  await db.write();
  res.json({ success: true, data: updated });
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', async (req, res) => {
  await db.read();
  const before = db.data.expenses.length;
  db.data.expenses = db.data.expenses.filter(e => e.id !== Number(req.params.id));
  if (db.data.expenses.length === before)
    return res.status(404).json({ success: false, error: 'Not found' });
  await db.write();
  res.json({ success: true, message: 'Deleted successfully' });
});

// GET /api/stats
app.get('/api/stats', async (_req, res) => {
  await db.read();
  const { expenses } = db.data;

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const count = expenses.length;

  const byCat = {};
  expenses.forEach(e => {
    if (!byCat[e.category]) byCat[e.category] = { category: e.category, total: 0, count: 0 };
    byCat[e.category].total += e.amount;
    byCat[e.category].count += 1;
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const byDayMap = {};
  expenses
    .filter(e => e.date >= cutoffStr)
    .forEach(e => { byDayMap[e.date] = (byDayMap[e.date] || 0) + e.amount; });
  const byDay = Object.entries(byDayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  res.json({
    success: true,
    data: {
      total,
      count,
      byCategory: Object.values(byCat),
      byDay,
    },
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Kharcha Tracker API → http://localhost:${PORT}`);
  console.log(`   Endpoints: GET/POST /api/expenses  |  GET /api/stats`);
});
