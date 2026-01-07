const USERS = { "0000": "Admin", "1234": "Staff" };
let currentUser = null;
let db = JSON.parse(localStorage.getItem("MAIMOON_DB_V2") || '{"gems":[], "sales":[], "returns":[]}');

// --- DATABASE HELPERS ---
const save = () => { localStorage.setItem("MAIMOON_DB_V2", JSON.stringify(db)); render(); };
const genID = (prefix) => prefix + Math.floor(1000 + Math.random() * 9000);

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
    document.getElementById('n-' + name.substring(0,3)).classList.add('active');
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

// --- 2. SALES LOGIC ---
function togglePartialInput() {
    const isPartial = document.getElementById('s-pay-type').value === "Partial";
    document.getElementById('s-paid').classList.toggle('hidden', !isPartial);
}

function updateSaleHint() {
    const g = db.gems.find(x => x.id === document.getElementById('s-select').value);
    document.getElementById('s-hint').innerText = g ? `Available: ${g.qty} pcs | ${g.carat} cts` : "";
}

// --- UPDATED SALES LOGIC WITH DUE TRACKING ---
function processSale() {
    const id = document.getElementById('s-select').value;
    const qty = Number(document.getElementById('s-qty').value);
    const carat = Number(document.getElementById('s-carat').value);
    const price = Number(document.getElementById('s-price').value);
    const buyer = document.getElementById('s-buyer').value;
    const payType = document.getElementById('s-pay-type').value;
    const paid = payType === "Full" ? price : Number(document.getElementById('s-paid').value);

    const gem = db.gems.find(g => g.id === id);
    
    // Validations
    if(!gem || carat > gem.carat) return alert("Sale quantity ≤ Available inventory quantity");
    if(!buyer) return alert("Customer name required");
    if(paid > price) return alert("Paid amount cannot exceed sale amount");

    const costPerCarat = gem.cost / gem.initCarat;
    const saleCost = costPerCarat * carat;
    const balance = price - paid;

    const saleRecord = {
        invId: genID("INV-"),
        date: new Date().toLocaleDateString(),
        buyer,
        itemId: id,
        itemType: gem.type,
        qty,
        carat,
        total: price,
        costAmount: saleCost, // Stored for P&L Reports
        paid,
        balance,
        profit: price - saleCost,
        status: balance === 0 ? "Paid" : "Due" // Set status to Due if balance exists
    };

    // Post-Sale Actions: Reduce Inventory
    gem.carat -= carat;
    gem.qty -= qty;
    
    // Inventory Status Logic
    if(gem.qty <= 0) gem.status = "Sold";
    else gem.status = "Partial";

    db.sales.push(saleRecord);
    save();
    generateInvoice(saleRecord);
}
// --- 4. REPORTS & RENDER ---
function render() {
    const isAdmin = currentUser === "Admin";
    const search = document.getElementById('inv-search').value.toLowerCase();

    // Render Inventory
    document.getElementById('stock-list').innerHTML = db.gems
    .filter(g => g.id.toLowerCase().includes(search) || g.type.toLowerCase().includes(search))
    .map(g => `
        <div class="list-item">
            <div><b>${g.id}</b> | ${g.type}</div>
            <div class="small">${g.qty} pcs | ${g.carat} cts | <span class="tag-${g.status.toLowerCase()}">${g.status}</span></div>
            ${isAdmin ? `<div class="gold">Cost: ${g.cost.toLocaleString()}</div>` : ''}
        </div>
    `).join('');

    // Update Dropdowns
    const options = '<option value="">-- Select Gem --</option>' + 
                    db.gems.filter(g => g.carat > 0).map(g => `<option value="${g.id}">${g.type} (${g.id})</option>`).join('');
    document.getElementById('s-select').innerHTML = options;

    // Render Reports
    let totalRev = 0, totalProf = 0;
    document.getElementById('report-list').innerHTML = db.sales.map(s => {
        totalRev += s.total;
        totalProf += s.profit;
        return `
            <div class="list-item">
                <div style="display:flex; justify-content:space-between">
                    <b>${s.invId}</b> <span>${s.total.toLocaleString()}</span>
                </div>
                <div class="small">${s.buyer} | ${s.status} | Bal: ${s.balance}</div>
                <button class="btn-print-sm" onclick="reprint('${s.invId}')">Reprint</button>
            </div>
        `;
    }).reverse().join('');

    if(isAdmin) {
        document.getElementById('r-rev').innerText = totalRev.toLocaleString();
        document.getElementById('r-prof').innerText = totalProf.toLocaleString();
    }
}

// --- INVOICE GENERATION ---
function generateInvoice(s) {
    const area = document.getElementById('print-area');
    
    // WhatsApp formatted string
    const waText = window.encodeURIComponent(
        `*MAIMOON GEM & JEWELLARY*\nInv: ${s.invId}\nCust: ${s.buyer}\nItem: ${s.item}\nTotal: LKR ${s.total.toLocaleString()}\n*Balance: LKR ${s.balance.toLocaleString()}*`
    );

    area.innerHTML = `
        <div class="invoice-paper">
            <div style="text-align: center; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
                <h2 style="margin: 0; color: #1a2a3a; font-size: 18px;">MAIMOON</h2>
                <p style="margin: 2px 0; font-size: 10px; letter-spacing: 1px;">GEM & JEWELLERY</p>
                <p style="margin: 5px 0 0 0; font-size: 9px; line-height: 1.2;">
                    101, Jayasundara Mawatha, Kalutara South<br>
                    +94 71 437 4374 | maimoongemjewllery@gmail.com
                </p>
            </div>

            <div style="margin: 15px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <div><b>BILL TO:</b><br>${s.buyer}</div>
                <div style="text-align: right;">
                    <b>INV:</b> ${s.invId}<br>
                    <b>DATE:</b> ${s.date}
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; flex-grow: 1;">
                <thead>
                    <tr style="border-bottom: 1px solid #000; text-align: left;">
                        <th style="padding: 5px 0;">Description</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 10px 0;">
                            <b>${s.item}</b><br>
                            <small>${s.qty} pcs | ${s.carat} cts</small>
                        </td>
                        <td style="text-align: right; vertical-align: top; padding-top: 10px;">
                            ${s.total.toLocaleString()}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                    <span>Sub Total:</span>
                    <span>LKR ${s.total.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                    <span>Paid Amount:</span>
                    <span>LKR ${s.paid.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border-top: 2px solid #1a2a3a; margin-top: 5px; padding-top: 5px;">
                    <span>BALANCE DUE:</span>
                    <span>LKR ${s.balance.toLocaleString()}</span>
                </div>
            </div>

            <div style="text-align: center; font-size: 9px; margin-top: 20px; color: #666;">
                <p>No Returns Without Original Invoice.<br><b>Thank You for Your Business!</b></p>
            </div>

            <div class="no-print" style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
                <button onclick="window.print()" class="btn-main" style="background:#27ae60; margin:0;">🖨️ Print / Save PDF</button>
                <a href="https://wa.me/?text=${waText}" target="_blank" class="btn-main" style="background:#25D366; text-decoration:none; text-align:center; color:white; line-height:45px; height:45px; margin:0; border-radius:10px;">
                   📱 Share WhatsApp
                </a>
                <button onclick="document.getElementById('print-area').classList.add('hidden')" class="btn-main" style="background:#7f8c8d; margin:0;">Back</button>
            </div>
        </div>
    `;
    area.classList.remove('hidden');
}

function reprint(id) {
    const s = db.sales.find(x => x.invId === id);
    if(s) generateInvoice(s);
}

// --- DATA MANAGEMENT ---
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "Maimoon_Backup_" + Date.now() + ".json");
    dlAnchorElem.click();
}

function importData() {
    const file = document.getElementById('importFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { 
        db = JSON.parse(e.target.result); 
        save(); 
        alert("System Restored Successfully"); 
    };
    reader.readAsText(file);
}

// --- UPDATED SALES LOGIC WITH DUE TRACKING ---
function processSale() {
    const id = document.getElementById('s-select').value;
    const qty = Number(document.getElementById('s-qty').value);
    const carat = Number(document.getElementById('s-carat').value);
    const price = Number(document.getElementById('s-price').value);
    const buyer = document.getElementById('s-buyer').value;
    const payType = document.getElementById('s-pay-type').value;
    const paid = payType === "Full" ? price : Number(document.getElementById('s-paid').value);

    const gem = db.gems.find(g => g.id === id);
    
    // Validations
    if(!gem || carat > gem.carat) return alert("Sale quantity ≤ Available inventory quantity");
    if(!buyer) return alert("Customer name required");
    if(paid > price) return alert("Paid amount cannot exceed sale amount");

    const costPerCarat = gem.cost / gem.initCarat;
    const saleCost = costPerCarat * carat;
    const balance = price - paid;

    const saleRecord = {
        invId: genID("INV-"),
        date: new Date().toLocaleDateString(),
        buyer,
        itemId: id,
        itemType: gem.type,
        qty,
        carat,
        total: price,
        costAmount: saleCost, // Stored for P&L Reports
        paid,
        balance,
        profit: price - saleCost,
        status: balance === 0 ? "Paid" : "Due" // Set status to Due if balance exists
    };

    // Post-Sale Actions: Reduce Inventory
    gem.carat -= carat;
    gem.qty -= qty;
    
    // Inventory Status Logic
    if(gem.qty <= 0) gem.status = "Sold";
    else gem.status = "Partial";

    db.sales.push(saleRecord);
    save();
    generateInvoice(saleRecord);
}

// --- UPDATED RETURN LOGIC WITH REFUND CALCULATION ---
function processReturn() {
    const flow = document.getElementById('ret-flow').value; // Customer or Supplier
    const ref = document.getElementById('ret-ref').value;   // Invoice ID or Gem ID
    const rQty = Number(document.getElementById('ret-qty').value);
    const rCarat = Number(document.getElementById('ret-carat').value);

    if (flow === "Customer") {
        // Find original sale by Invoice ID
        const sale = db.sales.find(s => s.invId === ref);
        if (!sale) return alert("Invoice Number not found");

        // Calculate Refund: (Total Sale / Total Carats) * Returned Carats
        const refundAmount = (sale.total / sale.carat) * rCarat;
        
        if (confirm(`Confirm Refund of LKR ${refundAmount.toLocaleString()}?`)) {
            // Add back to inventory
            const gem = db.gems.find(g => g.id === sale.itemId);
            if (gem) {
                gem.carat += rCarat;
                gem.qty += rQty;
                gem.status = "Available";
            }

            // Log Return Entry
            db.returns.push({
                date: new Date().toLocaleDateString(),
                type: "Customer Return",
                ref: ref,
                carat: rCarat,
                refund: refundAmount
            });
            
            alert(`Return Successful. Refund: LKR ${refundAmount.toLocaleString()}`);
            save();
        }
    } else {
        // Supplier Return Logic
        const gem = db.gems.find(g => g.id === ref);
        if (!gem || gem.carat < rCarat) return alert("Insufficient stock for supplier return");

        gem.carat -= rCarat;
        gem.qty -= rQty;
        
        db.returns.push({
            date: new Date().toLocaleDateString(),
            type: "Supplier Return",
            ref: ref,
            carat: rCarat
        });
        
        alert("Stock deducted for Supplier Return");
        save();
    }
}
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Maimoon PWA Ready!'))
            .catch(err => console.log('PWA Setup Failed', err));
    });
}


window.onload = render;
