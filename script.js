// --- CONFIGURATION & DATABASE ---
const USERS = { "0000": "Admin", "1234": "Staff" };
let currentUser = null;
let cart = [];

// Initialize DB
let db = JSON.parse(localStorage.getItem("MAIMOON_DB_V2") || '{"gems":[], "sales":[], "returns":[], "logs":[]}');

// --- DATABASE HELPERS ---
const save = () => { 
    localStorage.setItem("MAIMOON_DB_V2", JSON.stringify(db)); 
    render(); 
};
const genID = (prefix) => prefix + Math.floor(1000 + Math.random() * 9000);

// --- 1. OFFLINE SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Maimoon Pro: Offline Mode Active'))
            .catch(err => console.log('Maimoon Pro: Offline Setup Failed', err));
    });
}

// --- 2. SYSTEM LOGGING ---
function logAction(action) {
    if (!db.logs) db.logs = [];
    db.logs.push({ 
        time: new Date().toLocaleString(), 
        user: currentUser || "Unknown", 
        detail: action 
    });
    if (db.logs.length > 100) db.logs.shift();
}

// --- 3. AUTH & NAVIGATION ---
function checkPin() {
    const pin = document.getElementById('pin-field').value;
    if (USERS[pin]) {
        currentUser = USERS[pin];
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser;
        render();
        logAction("User Logged In");
    } else { 
        alert("Access Denied"); 
    }
}

function signOff() { 
    logAction("User Logged Out");
    currentUser = null; 
    location.reload(); 
}

function tab(name) {
    document.querySelectorAll('[id^="p-"]').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    
    document.getElementById('p-' + name).classList.remove('hidden');
    const navBtn = document.getElementById('n-' + name.substring(0,3));
    if(navBtn) navBtn.classList.add('active');
    
    // Auto-scroll to top for mobile users
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 4. INVENTORY LOGIC ---
function saveStock() {
    const gem = {
        id: document.getElementById('t-id').value || genID("GEM-"),
        type: document.getElementById('t-type').value,
        supplier: document.getElementById('t-supplier').value || "Unknown",
        treatment: document.getElementById('t-treatment').value,
        qty: Number(document.getElementById('t-qty').value),
        carat: Number(document.getElementById('t-carat').value),
        initCarat: Number(document.getElementById('t-carat').value),
        cost: Number(document.getElementById('t-cost').value),
        status: "Available"
    };

    if(db.gems.find(g => g.id === gem.id)) return alert("Gem ID must be unique");
    if(gem.qty <= 0 || gem.carat <= 0) return alert("Invalid Carat/Qty");

    db.gems.push(gem);
    logAction(`Added Stock: ${gem.id} (${gem.type})`);
    save();
    document.querySelectorAll('#p-inventory input').forEach(i => i.value = "");
}

// --- 5. MULTI-ITEM CART LOGIC ---
function updateSaleHint() {
    const g = db.gems.find(x => x.id === document.getElementById('s-select').value);
    const hint = document.getElementById('s-hint');
    if(hint) hint.innerText = g ? `Available: ${g.qty} pcs | ${g.carat.toFixed(2)} cts` : "";
}

function togglePartialInput() {
    const isPartial = document.getElementById('s-pay-type').value === "Partial";
    document.getElementById('s-paid').classList.toggle('hidden', !isPartial);
}

function addToCart() {
    const id = document.getElementById('s-select').value;
    const qty = Number(document.getElementById('s-qty').value);
    const carat = Number(document.getElementById('s-carat').value);
    const price = Number(document.getElementById('s-price').value);
    
    const gem = db.gems.find(g => g.id === id);
    if (!gem || carat <= 0 || price <= 0) return alert("Select gem and enter valid weight/price");
    if (carat > gem.carat) return alert("Not enough stock!");

    cart.push({
        id: gem.id, type: gem.type, qty: qty, carat: carat, price: price,
        unitCost: gem.cost / gem.initCarat
    });

    document.getElementById('s-qty').value = "";
    document.getElementById('s-carat').value = "";
    document.getElementById('s-price').value = "";
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-container');
    const list = document.getElementById('cart-list');
    const totalDisplay = document.getElementById('cart-total-display');
    
    if (cart.length === 0) {
        if(container) container.classList.add('hidden');
        return;
    }

    if(container) container.classList.remove('hidden');
    let total = 0;
    list.innerHTML = cart.map((item, index) => {
        total += item.price;
        return `<div style="display:flex; justify-content:space-between; padding:10px; background:#f9f9f9; border-bottom:1px solid #eee; align-items:center;">
                    <div style="font-size:12px;"><b>${item.type}</b> (${item.id})<br>${item.qty} pcs | ${item.carat} cts @ LKR ${item.price.toLocaleString()}</div>
                    <button onclick="removeFromCart(${index})" style="background:#ff4757; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">×</button>
                </div>`;
    }).join('');
    if(totalDisplay) totalDisplay.innerText = total.toLocaleString();
}

// --- 6. SALES PROCESSOR ---
// Add this inside your processSale() function
function processSale() {
    // ... existing logic to get inputs ...

    const gem = db.gems.find(g => g.id === selectedGemId);
    
    // Expert Profit Calculation: Cost per Carat
    const costPerCarat = gem.cost / gem.initCarat; 
    const saleCostBasis = costPerCarat * caratsToSell;
    const calculatedProfit = totalSalePrice - saleCostBasis;

    const newSale = {
        invId: genID("INV-"),
        buyer: customerName,
        gemId: gem.id,
        gemType: gem.type,
        qty: qtyToSell,
        carat: caratsToSell,
        total: totalSalePrice,
        paid: amountPaid,
        balance: totalSalePrice - amountPaid,
        profit: calculatedProfit, // This is saved permanently for the report
        date: new Date().toLocaleDateString(),
        status: (totalSalePrice - amountPaid) <= 0 ? "Paid" : "Partial"
    };

    db.sales.push(newSale);
    // ... rest of save and render logic ...
    function completeSale() {
    if (cart.length === 0) return alert("Cart is empty!");

    const buyerName = document.getElementById('sale-buyer').value || "Cash Customer";
    const amountPaid = Number(document.getElementById('sale-paid').value) || 0;
    
    // Mobile safety: Ensure numbers are strictly validated
    const totalSale = cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const balance = totalSale - amountPaid;

    const invId = genID("INV-");

    // Create the Sale Record
    const newSale = {
        invId: invId,
        buyer: buyerName,
        items: [...cart], // Deep copy cart
        total: totalSale,
        paid: amountPaid,
        balance: balance,
        date: new Date().toLocaleString(),
        status: balance <= 0 ? "Paid" : "Partial"
    };

    // Update Inventory for each item in cart
    cart.forEach(item => {
        const gem = db.gems.find(g => g.id === item.id);
        if (gem) {
            gem.qty -= item.qty;
            gem.carat -= item.carat;
            if (gem.qty <= 0) gem.status = "Sold";
        }
    });

    db.sales.push(newSale);
    save(); // This saves to localStorage and re-renders
    
    // Reset Cart
    cart = [];
    document.getElementById('sale-buyer').value = "";
    document.getElementById('sale-paid').value = "";
    
    // Automatically trigger Print for the new Invoice
    viewInvoice(invId); 
    alert("Sale Completed Successfully!");
}
}

// --- 7. UI RENDER & REPORTS ---
function render() {
    if (!currentUser) return;
    const isAdmin = currentUser === "Admin";
    const search = (document.getElementById('inv-search')?.value || "").toLowerCase();

    // Stock List
    const stockList = document.getElementById('stock-list');
    if(stockList) {
        stockList.innerHTML = db.gems
        .filter(g => g.id.toLowerCase().includes(search) || g.type.toLowerCase().includes(search) || g.supplier.toLowerCase().includes(search))
        .map(g => `
            <div class="list-item" style="border-left: 4px solid #d4af37; padding:10px; margin-bottom:5px; background:white;">
                <div style="display:flex; justify-content:space-between;"><b>${g.id}</b><span style="font-size:10px; background:#eee; padding:2px 5px; border-radius:3px;">Source: ${g.supplier}</span></div>
                <div>${g.type} <small style="color:#d4af37;">(${g.treatment})</small></div>
                <div class="small">${g.carat.toFixed(2)} cts | <span class="tag-${g.status.toLowerCase()}">${g.status}</span></div>
                ${isAdmin ? `<div class="gold" style="font-size:12px; font-weight:bold;">Cost: LKR ${g.cost.toLocaleString()}</div>` : ''}
            </div>`).join('');
    }

    // Sync Dropdown
    const saleSelect = document.getElementById('s-select');
    if (saleSelect) {
        const availableGems = db.gems.filter(g => g.carat > 0);
        saleSelect.innerHTML = `<option value="">-- Select Gem --</option>` + 
            availableGems.map(g => `<option value="${g.id}">${g.type} (${g.id})</option>`).join('');
    }

    // Reports Logic
    const revBox = document.getElementById('r-rev');
    const profBox = document.getElementById('r-prof');
    if(revBox) revBox.innerText = `LKR ${db.sales.reduce((a, b) => a + b.total, 0).toLocaleString()}`;
    if(profBox) profBox.innerText = isAdmin ? `LKR ${db.sales.reduce((a, b) => a + b.profit, 0).toLocaleString()}` : "LOCKED";

    const historyList = document.getElementById('report-list');
    const dueList = document.getElementById('due-report-list');

    if (historyList) {
        historyList.innerHTML = db.sales.slice().reverse().map(s => `
            <div class="list-item" style="border-left: 4px solid #1a2a3a; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>${s.invId}</span><span>LKR ${s.total.toLocaleString()}</span></div>
                <div class="small">${s.date} | Buyer: ${s.buyer}</div>
                <div style="margin-top:5px; display:flex; gap:5px;">
                    <button onclick="reprint('${s.invId}')" style="font-size:10px; padding:2px 8px;">Invoice</button>
                    ${s.balance > 0 ? `<button onclick="payBalance('${s.invId}')" style="font-size:10px; padding:2px 8px; background:#27ae60; color:white; border:none;">Collect Pay</button>` : ''}
                </div>
            </div>`).join('');
    }

    if (dueList) {
        const dues = db.sales.filter(s => s.balance > 0);
        dueList.innerHTML = dues.length ? dues.map(s => `
            <div class="list-item" style="border-left: 4px solid #e74c3c; background:#fff5f5;">
                <b>${s.buyer}</b><br><small>Total: ${s.total.toLocaleString()} | <span style="color:red; font-weight:bold;">Due: ${s.balance.toLocaleString()}</span></small>
                <button onclick="payBalance('${s.invId}')" style="display:block; width:100%; margin-top:5px; font-size:11px;">Add Payment</button>
            </div>`).join('') : '<p class="small">No outstanding balances.</p>';
    }
    function renderReturnHistory() {
    const container = document.getElementById('return-history-list'); // Add this ID in your HTML
    if(!container) return;
    container.innerHTML = '<h4>Return History</h4>';

    db.returns.slice().reverse().forEach(ret => {
        const div = document.createElement('div');
        div.className = 'card list-item';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <b>${ret.invId}</b>
                <span style="color:var(--red)">-LKR ${ret.refund.toLocaleString()}</span>
            </div>
            <div style="font-size:11px; color:#666;">
                Gem: ${ret.gemId} | ${ret.qty} Pcs | ${ret.carat} Cts | Date: ${ret.date}
            </div>
        `;
        container.appendChild(div);
    });
}
}


// --- 8. INVOICE & PAYMENTS ---
function generateInvoice(s) {
    const area = document.getElementById('print-area');
    
    // 1. Generate Multi-Item Rows
    const itemRows = s.items.map(item => `
        <tr>
            <td style="padding: 15px 10px; border: 1px solid #eee; border-left: 3px solid #d4af37;">
                <b style="text-transform: uppercase; color: #1a2a3a;">${item.type}</b><br>
                <small style="color:#777;">ID: ${item.id}</small>
            </td>
            <td style="padding: 10px; border: 1px solid #eee; text-align: center;">${item.qty}</td>
            <td style="padding: 10px; border: 1px solid #eee; text-align: center;">${item.carat} Cts</td>
            <td style="padding: 10px; border: 1px solid #eee; text-align: right; font-weight: bold;">${item.price.toLocaleString()}</td>
        </tr>`).join('');

    // 2. Generate Payment History Rows (Shows initial + balance payments)
    const paymentRows = s.payments.map((p, idx) => `
        <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; color: #666;">
            <span>Payment ${idx + 1} (${p.date}):</span>
            <span>- LKR ${p.amount.toLocaleString()}</span>
        </div>`).join('');

    // 3. Prepare WhatsApp Text
    const waText = window.encodeURIComponent(`*MAIMOON GEM & JEWELLERY*\n*Invoice:* ${s.invId}\n*Customer:* ${s.buyer}\n*Total:* LKR ${s.total.toLocaleString()}\n*Balance:* LKR ${s.balance.toLocaleString()}`);

    // 4. Render Template
    area.innerHTML = `
        <div class="invoice-paper" style="padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background: #fff; max-width: 800px; margin: auto; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            
            <div style="text-align: right; margin-bottom: -15px;">
                <h1 style="margin: 0; color: #d4af37; font-size: 10px; letter-spacing: 2px; opacity: 0.8;">INVOICE</h1>
            </div>

            <div style="text-align: center; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="logo.png" alt="MAIMOON LOGO" style="max-height: 100px; margin-bottom: 1px; display: block; margin-left: auto; margin-right: auto;">
                <p style="margin: 0; font-size: 10px; line-height: 1.4; color: #666;">
                    101, Jayasundara Mawatha, Kalutara South<br>
                    Tel: +94 71 437 4374 | Email: maimoongemjewllery@gmail.com
                </p>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px;">
                <div>
                    <h4 style="margin: 0 0 5px 0; color: #d4af37; font-size: 10px; letter-spacing: 1px;">BILL TO:</h4>
                    <p style="margin: 0; font-size: 15px; font-weight: bold; color: #1a2a3a;">${s.buyer}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0;"><b>Invoice No:</b> ${s.invId}</p>
                    <p style="margin: 2px 0;"><b>Date:</b> ${s.date}</p>
                    <div style="margin-top: 5px; display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 10px; color: #fff; background: ${s.balance <= 0 ? '#27ae60' : '#e74c3c'};">
                        ${s.balance <= 0 ? 'FULLY PAID' : 'PAYMENT DUE'}
                    </div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                <thead>
                    <tr style="background: #1a2a3a; color: white; font-size: 12px; text-align: left;">
                        <th style="padding: 10px; border: 1px solid #1a2a3a;">Description</th>
                        <th style="padding: 10px; border: 1px solid #1a2a3a; text-align: center;">Qty</th>
                        <th style="padding: 10px; border: 1px solid #1a2a3a; text-align: center;">Weight</th>
                        <th style="padding: 10px; border: 1px solid #1a2a3a; text-align: right;">Total (LKR)</th>
                    </tr>
                </thead>
                <tbody style="font-size: 13px;">
                    ${itemRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                <div style="width: 280px; background: #fcfcfc; padding: 15px; border-radius: 5px; border: 1px solid #eee;">
                    <h4 style="margin: 0 0 10px 0; font-size: 11px; border-bottom: 1px solid #d4af37; padding-bottom: 5px; color: #555; letter-spacing: 1px;">PAYMENT HISTORY</h4>
                    
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px solid #eee; margin-bottom: 5px;">
                        <span>Grand Total:</span>
                        <span style="font-weight: bold;">LKR ${s.total.toLocaleString()}</span>
                    </div>

                    ${paymentRows}

                    <div style="display: flex; justify-content: space-between; padding: 10px 0 0 0; border-top: 2px solid #1a2a3a; margin-top: 10px; font-weight: bold; font-size: 16px; color: ${s.balance > 0 ? '#e74c3c' : '#1a2a3a'};">
                        <span>BALANCE DUE:</span>
                        <span>LKR ${s.balance.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 50px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="font-size: 10px; color: #777; width: 60%;">
                        <p style="margin: 0; font-weight: bold; color: #333; text-decoration: underline;">Terms & Conditions:</p>
                        <p style="margin: 4px 0 0 0;">1. Goods once sold are not returnable or exchangeable.</p>
                        <p style="margin: 2px 0;">2. All gemstones are natural; heat-treated stones are informed accordingly.</p>
                        <p style="margin: 2px 0; font-style: italic; color: #d4af37;">Thank you for your business!</p>
                    </div>
                    <div style="text-align: center; width: 180px;">
                        <div style="border-bottom: 1px solid #333; height: 50px;"></div>
                        <p style="font-size: 11px; margin-top: 8px; font-weight: bold; color: #1a2a3a; text-transform: uppercase;">Authorized Sign</p>
                    </div>
                </div>
            </div>

            <div class="no-print" style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button onclick="window.print()" style="background:#1a2a3a; color:white; padding:12px; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">Print Official PDF</button>
                <a href="https://wa.me/?text=${waText}" target="_blank" style="background:#25D366; color:white; text-align:center; padding:12px; text-decoration:none; border-radius:5px; font-weight:bold;">WhatsApp Details</a>
                <button onclick="document.getElementById('print-area').classList.add('hidden')" style="grid-column: span 2; background:#f4f4f4; color:#333; padding:10px; border:1px solid #ccc; border-radius:5px; cursor:pointer;">Close</button>
            </div>
        </div>`;
    area.classList.remove('hidden');
}

function payBalance(invId) {
    const sale = db.sales.find(s => s.invId === invId);
    if (!sale) return;
    const pStr = prompt(`Balance: LKR ${sale.balance.toLocaleString()}\nEnter Payment:`);
    const payment = Number(pStr);
    if (!payment || payment <= 0 || payment > sale.balance) return alert("Invalid Amount");

    sale.paid += payment;
    sale.balance -= payment;
    if (sale.balance <= 0) sale.status = "Paid";
    if(!sale.payments) sale.payments = [];
    sale.payments.push({ date: new Date().toLocaleDateString(), amount: payment });

    logAction(`Paid LKR ${payment} for ${invId}`);
    save();
    if(confirm("Payment Recorded. Show invoice?")) generateInvoice(sale);
}

function reprint(id) {
    const s = db.sales.find(x => x.invId === id);
    if(s) generateInvoice(s);
}

// --- 9. MISSING FUNCTIONS (ADD THESE TO BOTTOM) ---

function renderReports() {
    const reportList = document.getElementById('report-list');
    const revenueEl = document.getElementById('r-rev');
    const profitEl = document.getElementById('r-prof');
    
    let totalRevenue = 0;
    let totalProfit = 0;
    reportList.innerHTML = '';

    // Sort sales by date (newest first)
    const sortedSales = [...db.sales].reverse();

    sortedSales.forEach(sale => {
        // Calculate specific profit for this individual sale
        // We find the original cost from the gem's master data
        const gemMaster = db.gems.find(g => g.id === sale.gemId);
        
        // If the gem was deleted, we use the profit recorded at the time of sale
        const individualProfit = sale.profit || 0;
        
        totalRevenue += sale.total;
        totalProfit += individualProfit;

        const row = document.createElement('div');
        row.className = 'card item-list';
        row.innerHTML = `
            <div style="flex:1">
                <div style="display:flex; justify-content:space-between">
                    <b>${sale.invId}</b>
                    <span style="color:var(--s); font-weight:bold;">LKR ${sale.total.toLocaleString()}</span>
                </div>
                <div style="font-size:12px; margin-top:5px; color:#555;">
                    Customer: ${sale.buyer} <br>
                    Item: ${sale.gemType} (${sale.carat}ct) <br>
                    <span style="color:#27ae60">Profit: LKR ${individualProfit.toLocaleString()}</span>
                </div>
                <div style="margin-top:8px; display:flex; gap:5px;">
                    <button onclick="viewInvoice('${sale.invId}')" class="btn-small">View</button>
                    <span class="badge ${sale.status === 'Paid' ? 'bg-green' : 'bg-red'}">${sale.status}</span>
                </div>
            </div>
        `;
        reportList.appendChild(row);
    });

    // Update Top Summary Boxes
    revenueEl.innerText = `LKR ${totalRevenue.toLocaleString()}`;
    profitEl.innerText = `LKR ${totalProfit.toLocaleString()}`;
}

// Fix for "Export Backup" button
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "Maimoon_Backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Fix for "Process Adjustment" button
function processReturn() {
    const invId = document.getElementById('ret-ref').value; // Enter Invoice Number
    const retQty = Number(document.getElementById('ret-qty').value);
    const retCarat = Number(document.getElementById('ret-carat').value);

    // 1. Find the Sale
    const saleIndex = db.sales.findIndex(s => s.invId === invId);
    if (saleIndex === -1) return alert("Error: Invoice ID not found.");
    
    const sale = db.sales[saleIndex];
    const gem = db.gems.find(g => g.id === sale.gemId);

    // 2. Validation
    if (retQty > sale.qty || retCarat > sale.carat) {
        return alert(`Error: Cannot return more than sold (${sale.qty} pcs / ${sale.carat} ct).`);
    }

    // 3. Financial Reversal
    // Calculate the refund value based on the original sale price per carat
    const pricePerCarat = sale.total / sale.carat;
    const refundAmount = pricePerCarat * retCarat;

    // 4. Update Database
    // A. Update Stock
    if (gem) {
        gem.qty += retQty;
        gem.carat += retCarat;
        gem.status = "Available";
    }

    // B. Log the Return Entry
    if (!db.returns) db.returns = [];
    db.returns.push({
        invId: invId,
        gemId: sale.gemId,
        qty: retQty,
        carat: retCarat,
        refund: refundAmount,
        date: new Date().toLocaleDateString()
    });

    // C. Adjust the Sale Record
    sale.qty -= retQty;
    sale.carat -= retCarat;
    sale.total -= refundAmount;
    sale.profit -= (sale.profit / (sale.carat + retCarat)) * retCarat; // Pro-rata profit reduction

    // D. If fully returned, mark as Returned
    if (sale.qty <= 0) {
        sale.status = "Returned";
    }

    save(); // Sync to LocalStorage
    alert(`Success: LKR ${refundAmount.toLocaleString()} refunded and stock restored.`);
    
    // Clear Form
    document.getElementById('ret-ref').value = "";
    document.getElementById('ret-qty').value = "";
    document.getElementById('ret-carat').value = "";
}
function renderDueReport() {
    const dueList = document.getElementById('due-report-list');
    dueList.innerHTML = '';

    const debtors = db.sales.filter(s => s.balance > 0);

    if (debtors.length === 0) {
        dueList.innerHTML = '<p style="text-align:center; color:#999;">No outstanding balances.</p>';
        return;
    }

    debtors.forEach(s => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.borderLeft = "4px solid var(--red)";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <b>${s.buyer}</b>
                <span style="color:var(--red)">Due: LKR ${s.balance.toLocaleString()}</span>
            </div>
            <div style="font-size:11px; color:#666;">
                Inv: ${s.invId} | Phone: ${s.phone || 'N/A'}
            </div>
            <button onclick="payBalance('${s.invId}')" style="margin-top:5px; font-size:10px; padding:4px 8px;">Record Payment</button>
        `;
        dueList.appendChild(div);
    });
}


window.onload = () => { if(currentUser) render(); };
