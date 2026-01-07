const USERS = { "0000": "Admin", "1234": "Staff" };
let currentUser = null;
let db = JSON.parse(localStorage.getItem("MAIMOON_DB_V2") || '{"gems":[], "sales":[], "returns":[], "logs":[]}');

// --- DATABASE HELPERS ---
const save = () => { localStorage.setItem("MAIMOON_DB_V2", JSON.stringify(db)); render(); };
const genID = (prefix) => prefix + Math.floor(1000 + Math.random() * 9000);

function logAction(action) {
    if (!db.logs) db.logs = [];
    db.logs.push({ time: new Date().toLocaleString(), user: currentUser || "Unknown", detail: action });
    if (db.logs.length > 100) db.logs.shift();
}

// --- AUTH & NAV ---
function checkPin() {
    const pin = document.getElementById('pin-field').value;
    if (USERS[pin]) {
        currentUser = USERS[pin];
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser;
        render();
    } else { alert("Access Denied"); }
}

function signOff() { currentUser = null; location.reload(); }

function tab(name) {
    document.querySelectorAll('[id^="p-"]').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('p-' + name).classList.remove('hidden');
    const navBtn = document.getElementById('n-' + name.substring(0,3));
    if(navBtn) navBtn.classList.add('active');
}

// --- 1. INVENTORY LOGIC ---
function saveStock() {
    const gem = {
        id: document.getElementById('t-id').value || genID("GEM-"),
        type: document.getElementById('t-type').value,
        qty: Number(document.getElementById('t-qty').value),
        carat: Number(document.getElementById('t-carat').value),
        initCarat: Number(document.getElementById('t-carat').value),
        cost: Number(document.getElementById('t-cost').value),
        status: "Available"
    };

    if(db.gems.find(g => g.id === gem.id)) return alert("Gem ID must be unique");
    if(gem.qty <= 0 || gem.carat <= 0) return alert("Invalid Carat/Qty");

    db.gems.push(gem);
    save();
    document.querySelectorAll('#p-inventory input').forEach(i => i.value = "");
}

// --- 2. SALES LOGIC (Updated to track dates) ---
function togglePartialInput() {
    const isPartial = document.getElementById('s-pay-type').value === "Partial";
    document.getElementById('s-paid').classList.toggle('hidden', !isPartial);
}

function updateSaleHint() {
    const g = db.gems.find(x => x.id === document.getElementById('s-select').value);
    document.getElementById('s-hint').innerText = g ? `Available: ${g.qty} pcs | ${g.carat} cts` : "";
}

function processSale() {
    const id = document.getElementById('s-select').value;
    const qty = Number(document.getElementById('s-qty').value);
    const carat = Number(document.getElementById('s-carat').value);
    const price = Number(document.getElementById('s-price').value);
    const buyer = document.getElementById('s-buyer').value || "Cash Customer";
    
    const payType = document.getElementById('s-pay-type').value;
    let paid = price; 
    if (payType === "Partial") {
        paid = Number(document.getElementById('s-paid').value) || 0;
    }

    const gem = db.gems.find(g => g.id === id);
    if (!gem) return alert("Select a gem first");
    if (carat > gem.carat) return alert("Not enough stock!");

    const unitCost = gem.cost / gem.initCarat;
    const saleCost = unitCost * carat;
    const profit = price - saleCost;
    const balance = price - paid;

    const saleRecord = {
        invId: genID("INV-"),
        date: new Date().toLocaleDateString(),
        buyer: buyer,
        itemId: id,
        itemType: gem.type,
        qty: qty,
        carat: carat,
        costBasis: saleCost,
        profit: profit,
        total: price,
        paid: paid,
        balance: balance,
        status: balance <= 0 ? "Paid" : "Due",
        payments: [{ date: new Date().toLocaleDateString(), amount: paid }] // Tracks first payment
    };

    gem.carat -= carat;
    if (gem.carat <= 0) gem.status = "Sold";

    db.sales.push(saleRecord);
    logAction(`Sold ${carat}cts of ${gem.type} to ${buyer}`);
    save();
    generateInvoice(saleRecord);
}

// --- 3. BALANCE PAYMENT (Updated to track dates) ---
function payBalance(invId) {
    const sale = db.sales.find(s => s.invId === invId);
    if (!sale) return;

    const payment = Number(prompt(`Current Balance: LKR ${sale.balance.toLocaleString()}\nEnter payment amount:`));

    if (!payment || payment <= 0) return;
    if (payment > sale.balance) return alert("Payment exceeds balance!");

    sale.paid += payment;
    sale.balance -= payment;
    if (sale.balance <= 0) sale.status = "Paid";

    if(!sale.payments) sale.payments = [];
    sale.payments.push({ date: new Date().toLocaleDateString(), amount: payment }); // Tracks subsequent payments

    logAction(`Balance payment for ${invId}`);
    save();
    generateInvoice(sale);
}

// --- 4. RENDER & UI ---
function render() {
    const isAdmin = currentUser === "Admin";
    const search = (document.getElementById('inv-search')?.value || "").toLowerCase();

    document.getElementById('stock-list').innerHTML = db.gems
    .filter(g => g.id.toLowerCase().includes(search) || g.type.toLowerCase().includes(search))
    .map(g => `
        <div class="list-item">
            <div><b>${g.id}</b> | ${g.type}</div>
            <div class="small">${g.qty} pcs | ${g.carat} cts | <span class="tag-${g.status.toLowerCase()}">${g.status}</span></div>
            ${isAdmin ? `<div class="gold">Cost: ${g.cost.toLocaleString()}</div>` : ''}
        </div>
    `).join('');

    const options = '<option value="">-- Select Gem --</option>' + 
                    db.gems.filter(g => g.carat > 0).map(g => `<option value="${g.id}">${g.type} (${g.id})</option>`).join('');
    document.getElementById('s-select').innerHTML = options;

    let totalRev = 0, totalDue = 0, totalProfit = 0;

    const dueHTML = db.sales.filter(s => s.status === "Due").map(s => `
        <div style="background: #fff0f0; border-left: 4px solid #e74c3c; padding: 10px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <b style="color:#c0392b;">${s.buyer}</b><br>
                <small>Inv: ${s.invId} | Bal: <b>LKR ${s.balance.toLocaleString()}</b></small>
            </div>
            <button onclick="payBalance('${s.invId}')" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;">Pay Balance</button>
        </div>
    `).join('') || '<p style="color:#888; font-size:12px;">No outstanding payments.</p>';

    const historyHTML = db.sales.slice().reverse().map(s => {
        totalRev += s.paid;
        totalDue += s.balance;
        totalProfit += (s.profit || 0);

        return `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
            <div style="display:flex; justify-content:space-between;">
                <span><b>${s.invId}</b> <small>(${s.date})</small></span>
                <b style="color:${s.status === 'Due' ? '#e74c3c' : '#27ae60'}">LKR ${s.total.toLocaleString()}</b>
            </div>
            <div style="font-size:12px; color:#555;">${s.buyer} | ${s.itemType} (${s.carat} cts)</div>
            
            ${isAdmin ? `
            <div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px; font-size:11px; display:flex; justify-content:space-between;">
                <span>Cost: ${Math.round(s.costBasis || 0).toLocaleString()}</span>
                <span style="color:${(s.profit || 0) >= 0 ? 'green' : 'red'};">
                    ${(s.profit || 0) >= 0 ? 'Profit' : 'Loss'}: ${Math.abs(Math.round(s.profit || 0)).toLocaleString()}
                </span>
                <button onclick="reprint('${s.invId}')" style="font-size:10px; background:none; border:1px solid #ccc; cursor:pointer;">Reprint</button>
            </div>
            ` : ''}
        </div>`;
    }).join('');

    document.getElementById('report-list').innerHTML = `
        <div style="padding:10px;">
            <h3 style="font-size:14px; color:#e74c3c; border-bottom: 1px solid #eee; padding-bottom:5px;">⚠️ DUE PAYMENTS</h3>
            ${dueHTML}
            <h3 style="font-size:14px; color:#2c3e50; border-bottom: 1px solid #eee; padding-bottom:5px; margin-top:20px;">📜 SALES & PROFIT DETAILS</h3>
            ${historyHTML}
        </div>
    `;

    if(isAdmin) {
        if(document.getElementById('r-rev')) document.getElementById('r-rev').innerText = totalRev.toLocaleString();
        if(document.getElementById('r-profit')) document.getElementById('r-profit').innerText = totalProfit.toLocaleString();
        if(document.getElementById('r-due')) document.getElementById('r-due').innerText = totalDue.toLocaleString();
    }
}

// --- 5. INVOICE (FORMAL TYPE WITH LOGO & PAYMENT DATES) ---
function generateInvoice(s) {
    const area = document.getElementById('print-area');
    const waText = window.encodeURIComponent(`*MAIMOON GEM*\nInv: ${s.invId}\nTotal: LKR ${s.total.toLocaleString()}\nBalance: LKR ${s.balance.toLocaleString()}`);

    // Create Payment History Rows
    const paymentRows = (s.payments || []).map(p => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #555; padding: 2px 0;">
            <span>Paid on ${p.date}:</span>
            <span>LKR ${p.amount.toLocaleString()}</span>
        </div>
    `).join('');

    area.innerHTML = `
        <div class="invoice-paper" style="padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background: #fff; max-width: 800px; margin: auto;">
            
            <div style="text-align: right; margin-bottom: -15px;">
                <h1 style="margin: 0; color: #d4af37; font-size: 10px; letter-spacing: px; opacity: 0.8;">INVOICE</h1>
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
                    <tr>
                        <td style="padding: 15px 10px; border: 1px solid #eee; border-left: 3px solid #d4af37;">
                            <b style="text-transform: uppercase; color: #1a2a3a;">${s.itemType}</b>
                        </td>
                        <td style="padding: 10px; border: 1px solid #eee; text-align: center;">${s.qty}</td>
                        <td style="padding: 10px; border: 1px solid #eee; text-align: center;">${s.carat} Cts</td>
                        <td style="padding: 10px; border: 1px solid #eee; text-align: right; font-weight: bold;">${s.total.toLocaleString()}</td>
                    </tr>
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
                        <p style="margin: 2px 0;">2. All gemstones are natural; heat-treated stones are informed accordingly..</p>
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

function reprint(id) {
    const s = db.sales.find(x => x.invId === id);
    if(s) generateInvoice(s);
}

window.onload = () => { if(currentUser) render(); };