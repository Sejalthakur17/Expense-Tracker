const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Database (persistent)
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

// Initialize tables
db.serialize(() => {
    // Expenses table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL
    )`);

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default categories if empty
    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (row.count === 0) {
            const defaultCategories = [
                'Food & Dining', 'Transportation', 'Entertainment', 
                'Shopping', 'Bills & Utilities'
            ];
            const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
            defaultCategories.forEach(cat => stmt.run(cat));
            stmt.finalize();
        }
    });
});

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://localhost:3000',
        'http://127.0.0.1:5500',
        'http://192.168.1.100:5500'  // Add your IP here
    ]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve frontend

// 🔥 EXACT API ENDPOINTS FOR YOUR script.js
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        expenses: true,
        categories: true
    });
});

// Expenses - GET /api/expenses?limit=100
app.get('/api/expenses', (req, res) => {
    const { limit = 100, category } = req.query;
    let sql = 'SELECT * FROM expenses';
    let params = [];

    if (category) {
        sql += ' WHERE category = ?';
        params.push(category);
    }
    sql += ' ORDER BY date DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Expenses GET error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Expenses - POST /api/expenses
app.post('/api/expenses', (req, res) => {
    const { description, amount, category, date } = req.body;
    
    if (!description?.trim() || !amount || !category?.trim()) {
        return res.status(400).json({ 
            error: 'Missing required fields: description, amount, category' 
        });
    }

    const finalDate = date || new Date().toISOString().split('T')[0];
    
    db.run(
        'INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)',
        [description.trim(), parseFloat(amount), category.trim(), finalDate],
        function(err) {
            if (err) {
                console.error('Expenses POST error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`✅ Added expense #${this.lastID}: ${description} (₹${amount})`);
            res.json({ 
                id: this.lastID, 
                description, 
                amount: parseFloat(amount), 
                category, 
                date: finalDate 
            });
        }
    );
});

// Expenses - DELETE /api/expenses/:id
app.delete('/api/expenses/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM expenses WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Expenses DELETE error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        console.log(`🗑️ Deleted expense #${id}`);
        res.json({ deleted: true, changes: this.changes });
    });
});

// Stats - GET /api/stats
app.get('/api/stats', (req, res) => {
    db.all(`
        SELECT 
            category,
            COUNT(*) as count,
            ROUND(SUM(amount), 2) as total,
            ROUND(AVG(amount), 2) as avg
        FROM expenses 
        GROUP BY category
        ORDER BY total DESC
    `, (err, rows) => {
        if (err) {
            console.error('Stats error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Total - GET /api/total
app.get('/api/total', (req, res) => {
    db.get(`
        SELECT 
            COUNT(*) as count, 
            COALESCE(ROUND(SUM(amount), 2), 0) as total,
            ROUND(AVG(amount), 2) as avg_amount
        FROM expenses
    `, (err, row) => {
        if (err) {
            console.error('Total error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({
            total: parseFloat(row.total),
            count: parseInt(row.count),
            avg_amount: parseFloat(row.avg_amount) || 0
        });
    });
});

// Categories - GET /api/categories
app.get('/api/categories', (req, res) => {
    db.all('SELECT id, name FROM categories ORDER BY name ASC', (err, rows) => {
        if (err) {
            console.error('Categories error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Categories - POST /api/categories
app.post('/api/categories', (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) {
        return res.status(400).json({ error: 'Category name required' });
    }

    db.run(
        'INSERT OR IGNORE INTO categories (name) VALUES (?)',
        [name.trim()],
        function(err) {
            if (err) {
                console.error('Categories POST error:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                id: this.lastID, 
                name: name.trim(),
                created: this.changes > 0
            });
        }
    );
});

// Serve frontend files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    db.close((err) => {
        if (err) console.error(err.message);
        console.log('✅ Database closed.');
        process.exit(0);
    });
});

// Start Server - BIND TO ALL IPS (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Backend Server Started!`);
    console.log(`📡 Network: http://0.0.0.0:${PORT}`);
    console.log(`🌐 Local:   http://localhost:${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}/`);
    console.log(`🔍 Health:  http://localhost:${PORT}/api/health`);
    console.log(`📊 Database: ${path.join(__dirname, 'database.db')}`);
});