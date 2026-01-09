// --- CONFIGURATION & DATABASE ---
const USERS = { "0000": "Admin", "1234": "Staff" };
let currentUser = null;
let cart = [];

// Initialize DB with all required tables
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
    // No need to call save() here if it's called immediately after in the main functions
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
    if (!gem || carat <= 0 || price <= 0) return alert("Please select a gem and enter valid weight/price");
    if (carat > gem.carat) return alert("Not enough stock!");

    cart.push({
        id: gem.id,
        type: gem.type,
        qty: qty,
        carat: carat,
        price: price,
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
        return `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#f9f9f9; border-bottom:1px solid #eee; align-items:center;">
                <div style="font-size:12px;">
                    <b>${item.type}</b> (${item.id})<br>
                    ${item.qty} pcs | ${item.carat} cts @ LKR ${item.price.toLocaleString()}
                </div>
                <button onclick="removeFromCart(${index})" style="background:#ff4757; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">×</button>
            </div>
        `;
    }).join('');
    
    if(totalDisplay) totalDisplay.innerText = total.toLocaleString();
}

// --- 6. SALES PROCESSOR ---
function processSale() {
    if (cart.length === 0) return alert("Cart is empty");

    const buyer = document.getElementById('s-buyer').value || "Cash Customer";
    const payType = document.getElementById('s-pay-type').value;
    const totalSalePrice = cart.reduce((sum, item) => sum + item.price, 0);
    const totalCostBasis = cart.reduce((sum, item) => sum + (item.unitCost * item.carat), 0);
    const paid = payType === "Full" ? totalSalePrice : Number(document.getElementById('s-paid').value || 0);

    const saleRecord = {
        invId: genID("INV-"),
        date: new Date().toLocaleDateString(),
        buyer: buyer,
        items: [...cart], 
        total: totalSalePrice,
        paid: paid,
        balance: totalSalePrice - paid,
        profit: totalSalePrice - totalCostBasis,
        status: (totalSalePrice - paid) <= 0 ? "Paid" : "Due",
        payments: [{ date: new Date().toLocaleDateString(), amount: paid }]
    };

    cart.forEach(item => {
        const gem = db.gems.find(g => g.id === item.id);
        if (gem) {
            gem.qty -= item.qty;
            gem.carat -= item.carat;
            if (gem.carat <= 0) gem.status = "Sold";
        }
    });

    db.sales.push(saleRecord);
    logAction(`Bulk sale to ${buyer}: LKR ${totalSalePrice}`);
    cart = []; 
    save();
    generateInvoice(saleRecord);
    renderCart();
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
                <div style="display:flex; justify-content:space-between;">
                    <b>${g.id}</b> 
                    <span style="font-size:10px; background:#eee; padding:2px 5px; border-radius:3px;">Source: ${g.supplier}</span>
                </div>
                <div>${g.type} <small style="color:#d4af37;">(${g.treatment})</small></div>
                <div class="small">${g.carat.toFixed(2)} cts | <span class="tag-${g.status.toLowerCase()}">${g.status}</span></div>
                ${isAdmin ? `<div class="gold" style="font-size:12px; font-weight:bold;">Cost: LKR ${g.cost.toLocaleString()}</div>` : ''}
            </div>
        `).join('');
    }

    // Sync Sales Dropdown
    const saleSelect = document.getElementById('s-select');
    if (saleSelect) {
        const availableGems = db.gems.filter(g => g.carat > 0);
        saleSelect.innerHTML = `<option value="">-- Select Gem --</option>` + 
            availableGems.map(g => `<option value="${g.id}">${g.type} (${g.id})</option>`).join('');
    }

    // Update Basic Reports
    const revBox = document.getElementById('r-rev');
    const profBox = document.getElementById('r-prof');
    if(revBox) {
        const totalRev = db.sales.reduce((a, b) => a + b.total, 0);
        revBox.innerText = `LKR ${totalRev.toLocaleString()}`;
    }
    if(profBox) {
        const totalProf = db.sales.reduce((a, b) => a + b.profit, 0);
        profBox.innerText = isAdmin ? `LKR ${totalProf.toLocaleString()}` : "LOCKED";
    }
}

// --- 8. INVOICE GENERATOR ---
function generateInvoice(s) {
    const area = document.getElementById('print-area');
    const waText = window.encodeURIComponent(`*MAIMOON GEM*\nInv: ${s.invId}\nTotal: LKR ${s.total.toLocaleString()}\nBalance: LKR ${s.balance.toLocaleString()}`);

    const itemRows = s.items.map(item => `
        <tr>
            <td style="padding: 10px 5px; border-bottom: 1px solid #eee;">
                <b>${item.type}</b><br><small>${item.id}</small>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.carat} Cts</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${item.price.toLocaleString()}</td>
        </tr>`).join('');

    area.innerHTML = `
        <div class="invoice-paper" style="padding: 20px; font-family: sans-serif; background: #fff; max-width: 800px; margin: auto; border: 1px solid #eee;">
            <div style="text-align: center; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="logo.png" style="max-height: 80px; margin-bottom: 5px;">
                <h2 style="margin:0;">MAIMOON GEM</h2>
                <p style="font-size:10px; color:#666;">Tel: +94 71 437 4374 | Kalutara South</p>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <span><b>To:</b> ${s.buyer}</span>
                <span><b>Inv:</b> ${s.invId}<br><b>Date:</b> ${s.date}</span>
            </div>
            <table width="100%" style="border-collapse:collapse;">
                <tr style="background:#1a2a3a; color:#fff;"><th>Item</th><th>Qty</th><th>Weight</th><th>Price</th></tr>
                ${itemRows}
            </table>
            <div style="text-align:right; margin-top:20px;">
                <h3>Total: LKR ${s.total.toLocaleString()}</h3>
                <h4 style="color:red;">Balance: LKR ${s.balance.toLocaleString()}</h4>
            </div>
            <div class="no-print" style="margin-top:20px;">
                <button onclick="window.print()" style="padding:10px 20px; background:#1a2a3a; color:#fff; border:none; cursor:pointer;">Print PDF</button>
                <button onclick="document.getElementById('print-area').classList.add('hidden')" style="padding:10px 20px;">Close</button>
            </div>
        </div>`;
    area.classList.remove('hidden');
}

// Initial Run
window.onload = () => { if(currentUser) render(); };