const USERS = { "0000": "Admin", "1234": "Staff" };
let currentUser = null;
let cart = [];
let db = JSON.parse(localStorage.getItem("MAIMOON_PRO_DB") || '{"gems":[], "sales":[], "returns":[],"logs":[]}');
// --- ACTIVITY LOG LOGIC ---
function logAction(action) {
    if (!db.logs) db.logs = [];
    const entry = {
        time: new Date().toLocaleString(),
        user: currentUser || "Unknown",
        detail: action
    };
    db.logs.push(entry);
    // Keep only the last 100 entries to save space
    if (db.logs.length > 100) db.logs.shift(); 
}

// Add this to your render() function to show the logs in the Report tab
function renderLogs() {
    if (!db.logs) return;
    const logBody = document.getElementById('activity-log-body');
    if (logBody) {
        logBody.innerHTML = db.logs.map(l => `
            <tr style="font-size:11px; border-bottom:1px solid #eee;">
                <td style="color:#888; white-space:nowrap;">${l.time}</td>
                <td><b>${l.user}</b></td>
                <td>${l.detail}</td>
            </tr>`).reverse().join('');
    }
}

// --- UTILITIES & ID GENERATORS ---
const save = () => { localStorage.setItem("MAIMOON_PRO_DB", JSON.stringify(db)); render(); };
const generateGemID = () => "GEM-" + Math.floor(1000 + Math.random() * 9000);
const generateInvoiceID = () => "INV-" + Date.now().toString().slice(-6);

// --- SIGN IN LOGIC ---
function checkPin() {
    const pinField = document.getElementById('pin-field');
    const pin = pinField.value;

    if (USERS[pin]) {
        currentUser = USERS[pin];
        
        // UI Updates
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        document.getElementById('user-display').innerText = currentUser;
        
        // Clear field for security
        pinField.value = ""; 
        
        // Log the event
        logAction("User Signed In"); 
        
        render();
    } else { 
        alert("Invalid PIN. Please try again."); 
        pinField.value = "";
    }
}

// --- SIGN OFF LOGIC ---
function signOff() {
    if (confirm("Are you sure you want to Sign Off?")) {
        // Log the event before clearing currentUser
        logAction("User Signed Off");

        // Reset App State
        currentUser = null;
        cart = []; // Clear current basket on logout
        
        // UI Updates
        document.getElementById('main-interface').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('pin-field').focus();
        
        // Clear any cart display
        const cartList = document.getElementById('cart-list');
        if(cartList) cartList.innerHTML = "";
    }
}

function tab(name) {
    document.querySelectorAll('[id^="p-"]').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('p-' + name).classList.remove('hidden');
    document.getElementById('n-' + name.substring(0,3)).classList.add('active');
    render();
}

function getStockStatus(carat) {
    return carat <= 0 ? { label: "OUT", color: "#e74c3c" } : { label: "IN", color: "#27ae60" };
}

// --- STOCK LOGIC ---

// Updated Stock Save with Logging
function saveStock() {
    const id = document.getElementById('edit-id').value;
    const type = document.getElementById('t-type').value;
    const qty = Number(document.getElementById('t-qty').value);
    
    if (id) {
        let g = db.gems.find(x => x.id === id);
        Object.assign(g, { type, /* ... rest of fields ... */ });
        logAction(`Updated Gem: ${g.id} (${type})`);
    } else {
        const newID = generateGemID();
        db.gems.push({ id: newID, type, /* ... rest of fields ... */ });
        logAction(`Added New Gem: ${newID} (${type})`);
    }
    save();
}

// Updated Sale with Logging
function processBulkSale() {
    if (cart.length === 0) return;
    const invID = generateInvoiceID();
    const buyer = document.getElementById('s-buyer').value || "Walk-in";
    
    const saleObj = { id: invID, buyerName: buyer, /* ... rest of fields ... */ };
    
    db.sales.push(saleObj);
    logAction(`Generated Invoice ${invID} for ${buyer}`); // <--- Log path trigger
    save();
    generateInvoice(saleObj);
}

function editGem(id) {
    let g = db.gems.find(x => x.id === id);
    if(!g) return;
    document.getElementById('t-type').value = g.type;
    document.getElementById('t-supplier').value = g.supplier;
    document.getElementById('t-qty').value = g.qty;
    document.getElementById('t-carat').value = g.carat;
    document.getElementById('t-cost').value = g.cost;
    document.getElementById('edit-id').value = g.id;
    document.getElementById('btn-save').innerText = "Update Item";
    document.getElementById('btn-cancel').classList.remove('hidden');
    window.scrollTo(0,0);
}

function cancelEdit() {
    document.getElementById('edit-id').value = "";
    document.getElementById('t-type').value = "";
    document.getElementById('t-supplier').value = "";
    document.getElementById('t-qty').value = "";
    document.getElementById('t-carat').value = "";
    document.getElementById('t-cost').value = "";
    document.getElementById('btn-save').innerText = "Add Stock";
    document.getElementById('btn-cancel').classList.add('hidden');
}

// --- SALES LOGIC ---
function addToCart() {
    const id = document.getElementById('s-select').value;
    const sqty = Number(document.getElementById('s-qty').value);
    const scat = Number(document.getElementById('s-carat').value);
    const sprice = Number(document.getElementById('s-price').value);
    
    const gem = db.gems.find(g => g.id === id);
    if (!gem || scat > gem.carat) return alert("Invalid Stock Request");

    const costPerCarat = gem.cost / gem.initialCarat;
    const profit = sprice - (costPerCarat * scat);
    
    cart.push({ itemId: id, itemType: gem.type, sqty, scat, sprice, profit });
    
    document.getElementById('cart-list').innerHTML = cart.map((i, idx) => `
        <div class="card" style="display:flex; justify-content:space-between; font-size:12px;">
            <span>${i.itemType} (${i.scat}cts) - LKR ${i.sprice}</span>
            <button onclick="cart.splice(${idx},1); renderCart()" style="color:red; border:none; background:none;">X</button>
        </div>`).join('');
}

function processBulkSale() {
    if (cart.length === 0) return alert("Cart is empty");
    
    const uniqueInvoiceID = generateInvoiceID();
    const saleObj = {
        id: uniqueInvoiceID,
        date: new Date().toLocaleDateString(),
        buyerName: document.getElementById('s-buyer').value || "Walk-in Customer",
        items: [...cart],
        totalPrice: cart.reduce((a, b) => a + b.sprice, 0),
        totalProfit: cart.reduce((a, b) => a + b.profit, 0)
    };

    cart.forEach(c => {
        let g = db.gems.find(x => x.id === c.itemId);
        if (g) { g.qty -= c.sqty; g.carat -= c.scat; }
    });

    db.sales.push(saleObj);
    save();
    generateInvoice(saleObj);
    cart = [];
    document.getElementById('cart-list').innerHTML = "";
    document.getElementById('s-buyer').value = "";
}

// --- RETURN LOGIC ---
function processReturn() {
    const type = document.getElementById('return-type-select').value;
    const id = document.getElementById('r-select').value;
    const rqty = Number(document.getElementById('r-qty').value);
    const rcat = Number(document.getElementById('r-carat').value);
    const rAmt = Number(document.getElementById('r-amount').value);

    let gem = db.gems.find(g => g.id === id);
    if(!gem || !rqty || !rAmt) return alert("Please fill all return details");

    if (type === "Sales Return") {
        gem.qty += rqty; gem.carat += rcat;
    } else {
        if (rqty > gem.qty) return alert("Not enough stock for supplier return");
        gem.qty -= rqty; gem.carat -= rcat;
    }

    if(!db.returns) db.returns = [];
    db.returns.push({ date: new Date().toLocaleDateString(), type, item: gem.type, qty: rqty, carat: rcat, amount: rAmt });
    save();
    alert("Return processed: " + type);
}

// --- RENDER FUNCTION (The Brain) ---
// Paste your Base64 Logo string here
const MAIMOON_LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."; 

function render() {
    if (!currentUser) return;
    const isAdmin = currentUser === "Admin";
    const adminHide = isAdmin ? '' : 'admin-hidden';
    const q = document.getElementById('inv-search').value.toLowerCase();

    // 1. Stock List
    document.getElementById('stock-list').innerHTML = db.gems
        .filter(g => g.type.toLowerCase().includes(q) || g.id.toLowerCase().includes(q) || g.supplier.toLowerCase().includes(q))
        .map(g => `
        <tr>
            <td><small style="color:#888;">${g.id}</small><br><b>${g.type}</b><br><small>Sup: ${g.supplier}</small></td>
            <td class="${adminHide}">${g.cost.toLocaleString()}</td>
            <td>${g.qty}pcs / ${g.carat}cts <br> ${isAdmin ? `<button onclick="editGem('${g.id}')">Edit</button>` : ''}</td>
        </tr>`).reverse().join('');

    // 2. Dropdowns Sync
    const opts = '<option value="">--Select Item--</option>' + db.gems.map(g => `<option value="${g.id}">${g.type} (${g.id})</option>`).join('');
    if(document.getElementById('s-select')) document.getElementById('s-select').innerHTML = opts;
    if(document.getElementById('r-select')) document.getElementById('r-select').innerHTML = opts;

    // 3. Reports Calculation (Selling Price - Cost = Profit)
    let rev = 0, costTotal = 0, refunds = 0;

    const salesHTML = db.sales.map(s => {
        rev += s.totalPrice;
        
        // Calculate the exact cost of the items in this specific invoice
        let sCost = s.items.reduce((sum, item) => {
            let g = db.gems.find(x => x.id === item.itemId) || { cost:0, initialCarat: 1 };
            return sum + ((g.cost / g.initialCarat) * item.scat);
        }, 0);
        costTotal += sCost;

        let profit = s.totalPrice - sCost;

        // UPDATED TABLE ROW: Shows Sell Price, Cost, and Profit
        return `<tr>
            <td><small>${s.id}</small><br><b>${s.buyerName}</b><br><small>${s.date}</small></td>
            <td>${s.totalPrice.toLocaleString()}</td>
            <td class="${adminHide}">${sCost.toFixed(0)}</td>
            <td class="${adminHide}" style="color: ${profit >= 0 ? 'green' : 'red'}; font-weight:bold;">
                ${profit.toFixed(0)}
            </td>
            <td><button onclick="reprintInvoice('${s.id}')" style="font-size:10px;">Print</button></td>
        </tr>`;
    }).reverse().join('');
    
    document.getElementById('report-list').innerHTML = salesHTML;

    // 4. Returns History
    if(db.returns) {
        document.getElementById('returns-history-body').innerHTML = db.returns.map(r => {
            if(r.type === "Sales Return") refunds += r.amount;
            return `<tr>
                <td>${r.date}</td>
                <td><small>${r.type}</small></td>
                <td>${r.item}</td>
                <td style="color:red;">${r.amount.toLocaleString()}</td>
            </tr>`;
        }).reverse().join('');
    }

    // 5. Final P&L Summary
    if(isAdmin) {
        document.getElementById('r-total-cost').innerText = "LKR " + costTotal.toLocaleString();
        document.getElementById('r-total-revenue').innerText = "LKR " + rev.toLocaleString();
        document.getElementById('r-total-refunds').innerText = "LKR " + refunds.toLocaleString();
        const net = rev - costTotal - refunds;
        const netEl = document.getElementById('r-net-profit');
        netEl.innerText = "LKR " + net.toLocaleString();
        netEl.style.color = net >= 0 ? "green" : "red";
    }

    // Hide/Show Admin elements
    document.querySelectorAll('.admin-view').forEach(el => isAdmin ? el.classList.remove('admin-hidden') : el.classList.add('admin-hidden'));
    
    // Call Log Renderer
    if(typeof renderLogs === "function") renderLogs();
}

// --- DATA & PRINTING ---
function generateInvoice(data) {
    const area = document.getElementById('print-area');
    
    // Create the rows for the items table
    const itemRows = data.items.map(i => `
        <tr>
            <td style="text-align:left; padding: 8px; border-bottom: 1px solid #eee;">
                ${i.itemType}<br><small style="color:#666;">${i.scat} cts</small>
            </td>
            <td style="text-align:right; padding: 8px; border-bottom: 1px solid #eee;">
                ${i.sprice.toLocaleString()}
            </td>
        </tr>`).join('');

    area.innerHTML = `
        <div style="padding:30px; font-family: 'Arial', sans-serif; max-width: 600px; margin: auto; background: white; color: #333; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            
            <div style="text-align:center; margin-bottom: 20px;">
                <img src="logo.png" alt="MAIMOON LOGO" style="max-height: 100px; width: auto; margin-bottom: 10px;" onerror="this.style.display='none'">
                
                <h1 style="margin:0; color:#b8860b; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">MAIMOON GEM & JEWELLERY</h1>
                <p style="margin:5px 0; font-size: 14px; color: #555;">101, Jayasundara Mawatha, Kalutara South</p>
                <p style="margin:2px 0; font-size: 13px;">📞 +9471 437 4374 | ✉️ maimoongemjewllery@gmail.com</p>
            </div>

            <div style="border-top: 2px solid #b8860b; border-bottom: 1px solid #eee; padding: 10px 0; display:flex; justify-content:space-between; margin-bottom: 20px;">
                <span><strong>Invoice ID:</strong> ${data.id}</span>
                <span><strong>Date:</strong> ${data.date}</span>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p style="margin:0;"><strong>Customer Name:</strong> ${data.buyerName}</p>
            </div>

            <table style="width:100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background: #f4f4f4;">
                        <th style="text-align:left; padding: 10px;">Item Description</th>
                        <th style="text-align:right; padding: 10px;">Amount (LKR)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>

            <div style="text-align:right; border-top: 2px solid #eee; padding-top: 10px;">
                <p style="margin:0; font-size: 16px;"><strong>Grand Total:</strong></p>
                <h2 style="margin:0; color: #b8860b;">LKR ${data.totalPrice.toLocaleString()}</h2>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #888;">
                <p>This is a computer-generated invoice.</p>
                <p><strong>Thank you for choosing Maimoon Gem & Jewellery!</strong></p>
            </div>

            <div class="no-print" style="margin-top: 30px; display:flex; gap:10px; justify-content:center;">
                <button onclick="window.print()" style="padding: 12px 25px; background: #b8860b; color:white; border:none; cursor:pointer; font-weight:bold; border-radius:5px;">PRINT INVOICE</button>
                <button onclick="document.getElementById('print-area').classList.add('hidden')" style="padding: 12px 25px; background: #333; color:white; border:none; cursor:pointer; border-radius:5px;">CLOSE</button>
            </div>
        </div>`;
    
    area.classList.remove('hidden');
}

function exportData() {
    const blob = new Blob([JSON.stringify(db)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Maimoon_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function importData() {
    const input = document.getElementById('importFile');
    if(!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => { db = JSON.parse(e.target.result); save(); alert("✅ Database Restored!"); };
    reader.readAsText(input.files[0]);
}
// --- REPRINT LOGIC ---
function reprintInvoice(invoiceId) {
    // Find the sale in the database using the unique ID
    const sale = db.sales.find(s => s.id === invoiceId);
    
    if (sale) {
        generateInvoice(sale);
        // Scroll to top so the user sees the invoice overlay
        window.scrollTo(0, 0);
    } else {
        alert("❌ Error: Invoice not found.");
    }
}
function tab(name) {
    // Hide all panels starting with p-
    document.querySelectorAll('[id^="p-"]').forEach(p => p.classList.add('hidden'));
    
    // Remove active class from all nav buttons starting with n-
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    
    // Show the selected panel
    const targetPanel = document.getElementById('p-' + name);
    if(targetPanel) targetPanel.classList.remove('hidden');
    
    // Highlight the button (matches first 4 letters like n-inv, n-db)
    const targetBtn = document.getElementById('n-' + name.substring(0, 2)) || document.getElementById('n-' + name.substring(0, 3));
    if(targetBtn) targetBtn.classList.add('active');
    
    render();
}
// --- DATABASE EXPORT ---
function exportData() {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MAIMOON_G&J_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    logAction("Full System Backup Exported");
}

// --- DATABASE IMPORT ---
function importData() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput.files[0]) return alert("Please select a file first.");

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            // Verify it's a Maimoon file
            if (importedData.gems && importedData.sales) {
                if (confirm("DANGER: This will delete everything and load the backup. Continue?")) {
                    db = importedData;
                    save(); // This handles rendering and localStorage
                    logAction("System Restored from Backup File");
                    alert("System Successfully Restored!");
                    tab('inventory'); // Take user back to stock list
                }
            } else {
                alert("Invalid file format.");
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };
    reader.readAsText(fileInput.files[0]);
}