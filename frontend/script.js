class ExpenseTracker {
    constructor() {
        this.API_BASE = '/api';
        this.expenses = [];
        this.categories = [];
        this.stats = {};
        this.chart = null;
        this.init();
    }
    formatRupee(amount){
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount); } 
    

    async init() {
        this.setStatus('🔄', 'Connecting to backend...');
        try {
            await Promise.all([
                this.loadExpenses(),
                this.loadCategories(),
                this.loadStats(),
                this.loadTotal()
            ]);
            this.renderExpenses();
            this.renderCategories();
            this.renderStats();
            this.renderChart();
            this.bindEvents();
            this.setStatus('🟢', 'Connected');
        } catch (error) {
            console.error('Initialization failed:', error);
            this.setStatus('🔴', 'Offline Mode');
            this.renderExpenses(); // Show cached data
            this.renderCategories();
        }
    }

    setStatus(icon, text) {
        document.getElementById('statusIcon').textContent = icon;
        document.getElementById('statusText').textContent = text;
    }

    async apiRequest(endpoint, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                signal: controller.signal,
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`API Error ${endpoint}:`, error);
            }
            throw error;
        }
    }

    // Data Loading
    async loadExpenses() {
        try {
            this.expenses = await this.apiRequest('/expenses?limit=100');
        } catch {
            this.expenses = [];
        }
    }

    async loadCategories() {
        try {
            this.categories = await this.apiRequest('/categories');
            this.populateCategorySelect();
        } catch {
            this.categories = [
                { id: 1, name: 'Food & Dining' },
                { id: 2, name: 'Transportation' },
                { id: 3, name: 'Entertainment' },
                { id: 4, name: 'Shopping' },
                { id: 5, name: 'Bills & Utilities' }
            ];
            this.populateCategorySelect();
        }
    }

    async loadStats() {
        try {
            this.stats = await this.apiRequest('/stats');
        } catch {
            this.stats = {};
        }
    }

    async loadTotal() {
        try {
            const data = await this.apiRequest('/total');
            document.getElementById('totalSpent').textContent = this.formatRupee(data.total || 0);
            document.getElementById('expenseCount').textContent = data.count || 0;
            document.getElementById('categoryCount').textContent = Object.keys(this.stats).length || this.categories.length;
        } catch {
            const total = this.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
            document.getElementById('totalSpent').textContent = this.formatRupee(total);
            document.getElementById('expenseCount').textContent = this.expenses.length;
            document.getElementById('categoryCount').textContent = this.categories.length;
        }
    }

    // Rendering
    renderExpenses() {
        const container = document.getElementById('expensesContainer');
        if (this.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt-line fa-4x"></i>
                    <h3>No expenses yet</h3>
                    <p>Add your first expense using the form above!</p>
                </div>
            `;
            document.getElementById('clearAllBtn').style.display = 'none';
            return;
        }

        container.innerHTML = this.expenses.map(expense => `
            <article class="expense-card" data-id="${expense.id}">
                <div class="expense-content">
                    <h4 class="expense-title">${expense.description || 'Unnamed'}</h4>
                    <div class="expense-meta">
                        <span class="category-badge">${expense.category || 'Uncategorized'}</span>
                        <span class="expense-date">${this.formatRupee(expense.amount || 0)}</span>
                    </div>
                </div>
                <div class="expense-actions">
                    <span class="expense-amount">${this.formatRupee(expense.amount || 0)}</span>
                    <button class="delete-btn" title="Delete expense">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </article>
        `).join('');

        document.getElementById('clearAllBtn').style.display = 'inline-flex';
    }

    renderCategories() {
        const container = document.getElementById('categoriesList');
        container.innerHTML = this.categories.map(cat => `
            <div class="category-item" data-category="${cat.id || cat.name}">
                <div class="category-info">
                    <i class="fas fa-tag"></i>
                    <div>
                        <div class="category-name">${cat.name}</div>
                        <div class="category-expenses">${this.getCategoryExpenseCount(cat.name)} expenses</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderStats() {
        // Stats rendered via loadTotal()
    }

    renderChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const labels = this.stats.map(item => item.category);
    const data = this.stats.map(item => item.total);

    if (this.chart) {
        this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Category',
                data: data
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

    populateCategorySelect() {
        const select = document.getElementById('categorySelect');
        select.innerHTML = '<option value="">Select Category</option>' + 
            this.categories.map(cat => 
                `<option value="${cat.name}">${cat.name}</option>`
            ).join('');
    }

    getCategoryExpenseCount(categoryName) {
        return this.expenses.filter(e => e.category === categoryName).length;
    }

    // CRUD Operations
    async addExpense(formData) {
        const data = {
            description: formData.description.trim(),
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: formData.date || new Date().toISOString().split('T')[0]
        };

        await this.apiRequest('/expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        await this.refreshAll();
        this.showNotification('✅ Expense added!', 'success');
    }

    async deleteExpense(id) {
        await this.apiRequest(`/expenses/${id}`, { method: 'DELETE' });
        await this.refreshAll();
        this.showNotification('🗑️ Expense deleted!', 'success');
    }

    async refreshAll() {
        await Promise.all([
            this.loadExpenses(),
            this.loadCategories(),
            this.loadStats(),
            this.loadTotal()
        ]);
        this.renderExpenses();
        this.renderCategories();
        this.renderStats();
        this.renderChart();
    }

    // Event Bindings
    bindEvents() {
        // Add Expense Form
        document.getElementById('expenseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(e.target));
            try {
                await this.addExpense(formData);
                e.target.reset();
                document.querySelector('input[name="date"]').value = '';
            } catch (error) {
                this.showNotification('❌ Failed to add expense', 'error');
            }
        });

        // Delete Expenses
        document.getElementById('expensesContainer').addEventListener('click', async (e) => {
            if (e.target.closest('.delete-btn')) {
                const card = e.target.closest('.expense-card');
                const id = card.dataset.id;
                if (confirm('Delete this expense?')) {
                    await this.deleteExpense(id);
                }
            }
        });

        // Clear All
        document.getElementById('clearAllBtn').addEventListener('click', async () => {
            if (confirm('Delete ALL expenses? This cannot be undone.')) {
                try {
                    await Promise.all(
                        this.expenses.map(exp => this.apiRequest(`/expenses/${exp.id}`, { method: 'DELETE' }))
                    );
                    await this.refreshAll();
                } catch (error) {
                    this.showNotification('❌ Failed to clear expenses', 'error');
                }
            }
        });

        // Add Category
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            const name = prompt('New category name:');
            if (name && name.trim()) {
                // Could POST to /api/categories
                this.categories.push({ name: name.trim() });
                this.renderCategories();
                this.populateCategorySelect();
                this.showNotification('🏷️ Category added!', 'success');
            }
        });

        // Category Filter
        document.getElementById('categoriesList').addEventListener('click', (e) => {
            const categoryItem = e.target.closest('.category-item');
            if (categoryItem) {
                const category = categoryItem.dataset.category;
                document.getElementById('categorySelect').value = category;
                // Highlight active category
                document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
                categoryItem.classList.add('active');
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Global tracker instance
const tracker = new ExpenseTracker();

// Auto-refresh every 30 seconds
setInterval(() => tracker.refreshAll(), 30000);