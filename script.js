const ADMIN_PASSWORD = "store 2026";

let Product = [];
let socket;

// Connect to server
document.addEventListener("DOMContentLoaded", () => {
  socket = io();

  socket.on("connect", () => {
    console.log("Socket connected");
  });

  socket.on("menuUpdate", (updatedMenu) => {
    menu = updatedMenu;
    if (document.getElementById("userSection").style.display !== "none") {
      loadMenu();
    }

    if (document.getElementById("adminPanel").style.display !== "none") {
      loadAdminMenu();
      // update admin orders view if present
      if (typeof loadAdminOrders === "function") loadAdminOrders();
    }
  });

  socket.on("ordersUpdate", (orders) => {
    console.log("Orders updated:", orders);
    window.allOrders = orders;
    // Always refresh admin orders view if it exists
    try {
      loadAdminOrders();
      loadAdminOrderHistory();
    } catch (e) {}
    // if current user, request history update
    if (window.currentUser && window.currentUser.email) {
      socket.emit("requestUserHistory", window.currentUser.email);
    }
  });

  socket.on("orderError", (err) => {
    alert(err.message);
    console.log("Order error:", err);
  });

  socket.on("orderConfirmed", (order) => {
    console.log("Order confirmed:", order);
    showNotification(`Order confirmed (#${order.orderId})`);
    // show a basic receipt
    showReceipt(order);
    // request updated history
    if (window.currentUser && window.currentUser.email) {
      socket.emit("requestUserHistory", window.currentUser.email);
    }
  });

  socket.on("userHistory", (history) => {
    console.log("User history received:", history);
    window.userHistory = history;
    renderUserHistory();
  });

  socket.on("salesReport", (report) => {
    console.log("Sales Report:", report);

    const container = document.getElementById("salesReport");
    container.innerHTML = `
    <div style="margin-bottom: 15px;">
      <h3>📊 Sales Report (${report.length} items)</h3>
    </div>
    
    <div id="salesReportCarousel" class="box-carousel" style="position:relative; overflow:hidden; max-width:100%;">
      <div id="salesReportTrack" class="carousel-track" style="display:flex; transition:transform 0.4s ease; gap:15px;">
        ${report
          .map(
            (r) => `
          <div class="sales-card" style="flex:0 0 calc(33.333% - 10px); height:200px; background:linear-gradient(135deg, #115099ff, #38ef7d); border-radius:16px; padding:20px; color:white; box-shadow:0 10px 30px rgba(17,153,142,0.3); position:relative; overflow:hidden;">
            <div style="font-size:22px; font-weight:bold; margin-bottom:10px; text-shadow:0 2px 4px rgba(0,0,0,0.3);">
              ${r.name}
            </div>
            <div style="font-size:14px; opacity:0.9; margin-bottom:15px;">
              Total Sold
            </div>
            <div style="font-size:40px; font-weight:900; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.4); margin-bottom:10px;">
              ${r.totalQty} units
            </div>
            <div style="position:absolute; bottom:15px; right:15px; width:40px; height:40px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px;">
              🏆
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      
      ${
        report.length > 3
          ? `
        <button id="salesPrev" class="box-arrow" style="position:absolute; top:50%; left:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">‹</button>
        <button id="salesNext" class="box-arrow" style="position:absolute; top:50%; right:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">›</button>
        <div id="salesDots" style="text-align:center; margin-top:20px;"></div>
      `
          : ""
      }
    </div>`;

    // Initialize 3-card sales carousel
    if (report.length > 1) {
      initSalesReportCarousel(report.length);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  // handle server-provided session/token after user login
  socket.on("userLogged", (payload) => {
    if (!payload) return;
    window.currentUser = payload.user;
    if (payload.token) setCookie("canteen_token", payload.token, 365);
    showNotification(`Logged in as ${payload.user.name}`);
  });

  socket.on("sessionResumed", (payload) => {
    if (!payload) return;
    window.currentUser = payload.user;
    window.userHistory = payload.history || [];
    renderUserHistory();
    showNotification(`Welcome back, ${payload.user.name}`);
    if (document.getElementById("userLoginSection").style.display !== "none") {
      document.getElementById("userLoginSection").style.display = "none";
      document.getElementById("userSection").style.display = "block";
      loadMenu();
    }
  });
});

let currentSalesIndex = 0;
let totalSalesItems = 0;

function initSalesReportCarousel(itemCount) {
  totalSalesItems = itemCount;
  const VISIBLE_CARDS = 3;
  currentSalesIndex = 0;

  const track = document.getElementById("salesReportTrack");
  const prevBtn = document.getElementById("salesPrev");
  const nextBtn = document.getElementById("salesNext");

  if (prevBtn) prevBtn.onclick = () => slideSalesReportCarousel(-1);
  if (nextBtn) nextBtn.onclick = () => slideSalesReportCarousel(1);

  // Swipe support
  let startX = 0;
  track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });
  track.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) slideSalesReportCarousel(1);
    if (endX - startX > 50) slideSalesReportCarousel(-1);
  });
}

function slideSalesReportCarousel(direction) {
  const VISIBLE_CARDS = 3;
  const maxIndex = totalSalesItems - VISIBLE_CARDS;
  currentSalesIndex += direction;
  if (currentSalesIndex < 0) currentSalesIndex = 0;
  if (currentSalesIndex > maxIndex) currentSalesIndex = maxIndex;

  const track = document.getElementById("salesReportTrack");
  track.style.transform = `translateX(-${currentSalesIndex * 33.333}%)`;
}

/* Login Functions */
function loginAsUser() {
  document.getElementById("login").style.display = "none";
  document.getElementById("userLoginSection").style.display = "block";
}

function submitUserLogin() {
  const name = document.getElementById("userName").value.trim();
  const email = document.getElementById("userEmail").value.trim().toLowerCase();

  // Validate name
  if (!name) {
    showNotification("Please enter your name", "error");
    return;
  }

  // Validate email format (strict RFC5322-like pattern)
  // Must have: text@domain.extension (e.g., user@gmail.com)
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!email) {
    showNotification("Please enter your email", "error");
    return;
  }

  if (!emailRegex.test(email)) {
    showNotification(
      "Please enter a valid email address (e.g., user@gmail.com)",
      "error",
    );
    return;
  }

  const user = { name, email };
  window.currentUser = user;

  // Notify server about user (for server-side persistence and token)
  if (socket && socket.connected) socket.emit("userLogin", user);

  // Show menu immediately
  document.getElementById("userLoginSection").style.display = "none";
  document.getElementById("userSection").style.display = "block";
  loadMenu();
}

// Restore session token from cookie and resume session with server
document.addEventListener("DOMContentLoaded", () => {
  try {
    const token = getCookie("canteen_token");
    if (token && socket && socket.connected) {
      socket.emit("resumeSession", token);
    }
  } catch (e) {}
});

// cookie helpers
function setCookie(name, value, days) {
  const expires = new Date(
    Date.now() + (days || 365) * 24 * 60 * 60 * 1000,
  ).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : null;
}

function loginAsAdmin() {
  document.getElementById("login").style.display = "none";
  document.getElementById("adminPassSection").style.display = "block";
}

function adminLogin() {
  if (document.getElementById("adminPass").value === ADMIN_PASSWORD) {
    document.getElementById("adminPassSection").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById("adminSales").style.display = "block";
    loadAdminMenu();
  } else {
    showNotification("Wrong password", "error");
  }
}

function logout() {
  document.getElementById("userLoginSection").style.display = "none";
  // const adminSection = document.getElementById("adminLoginSection");
  // if (adminSection) adminSection.style.display = "none";
  document.getElementById("userSection").style.display = "none";
  document.getElementById("adminPassSection").style.display = "none";
  document.getElementById("adminPanel").style.display = "none";
  // Show only main login selection
  document.getElementById("login").style.display = "block";

  // Clear input fields
  document.getElementById("userName").value = "";
  document.getElementById("userEmail").value = "";
  if (document.getElementById("adminPass"))
    document.getElementById("adminPass").value = "";
  // document.getElementById("login").style.display = "block";
  // // Hide all sections
  // document.getElementById("userSection").style.display = "none";
  // document.getElementById("adminPassSection").style.display = "none";
  // document.getElementById("adminPanel").style.display = "none";
  // // Show login

  // // Reset admin password field
  // document.getElementById("adminPass").value = "";
}

function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

/* User Functions */
function loadMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  menu.forEach((item, i) => {
    menuDiv.innerHTML += `
      <div class="menu-item" data-id="${item.id}">
        <div>
          <h4>${item.name}</h4>
        </div>
        <input type="number" min="0" value="0" oninput="calculateTotal()" placeholder="Qty">
      </div>`;
  });
}

function calculateTotal() {
  let total = 0;
  document.querySelectorAll(".menu-item input").forEach((input) => {
    const qty = Number(input.value) || 0;
    total += qty;
  });
  document.getElementById("total").innerText = total;
}

function placeOrder() {
  const orderItems = [];
  document.querySelectorAll(".menu-item").forEach((item) => {
    const id = item.dataset.id;
    const qty = Number(item.querySelector("input").value) || 0;
    if (qty > 0) orderItems.push({ id, qty });
  });

  if (orderItems.length === 0) {
    showNotification("Please select at least one item.", "error");
    return;
  }

  const button = document.querySelector("#userSection .btn-success");
  button.disabled = true;
  button.textContent = "Placing Order...";

  // Get user from window (set by server on login/resume)
  const user = window.currentUser;
  if (!user || !user.email) {
    showNotification("Please login with name and email first.", "error");
    button.disabled = false;
    button.textContent = "Place Order 🛒";
    return;
  }

  const payload = { items: orderItems, user };
  console.log("Emitting placeOrder payload:", payload);
  socket.emit("placeOrder", payload);

  setTimeout(() => {
    button.disabled = false;
    button.textContent = "Place Order 🛒";
    // do not immediately clear inputs - wait for orderConfirmed to reset after receipt shown
  }, 1000);
}

/* Admin Functions */
function addItem() {
  const nameInput = document.getElementById("itemName");
  const qtyInput = document.getElementById("itemqty");

  if (!nameInput || !qtyInput) {
    showNotification("Enter item details.", "error");
    return;
  }

  const name = nameInput.value.trim();
  const quantity = qtyInput.value.trim();

  const item = { name, stock: Number(quantity) };
  socket.emit("addItem", item);

  console.log("📦 Item object to emit:", item);

  document.getElementById("itemName").value = "";
  document.getElementById("itemqty").value = "";
  showNotification("Item added successfully!");
}

function removeItem(id) {
  socket.emit("removeItem", id);
}

function restockItem(itemId) {
  const input = document.getElementById(`restock-${itemId}`);
  const qty = Number(input.value);

  if (!qty || qty <= 0) {
    alert("Enter a valid stock quantity");
    return;
  }

  socket.emit("restockItem", {
    id: itemId,
    qty,
  });

  input.value = "";
}

function loadAdminMenu() {
  const list = document.getElementById("adminMenu");
  list.innerHTML = "";

  // NEWEST FIRST (optional - sort by ID or add timestamp later)
  const sortedMenu = [...menu].sort((a, b) => a.id - b.id);

  list.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3>Menu Items (${sortedMenu.length})</h3>
    </div>
    
    <div id="adminMenuCarousel" class="box-carousel" style="position:relative; overflow:hidden; max-width:100%;">
      <div id="adminMenuTrack" class="carousel-track" style="display:flex; transition:transform 0.4s ease; gap:15px;">
        ${sortedMenu
          .map(
            (item) => `
          <div class="menu-card" style="flex:0 0 calc(33.333% - 10px); height:220px; background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius:16px; padding:20px; color:white; box-shadow:0 10px 30px rgba(79,172,254,0.3); position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
              <div style="font-size:18px; font-weight:bold; flex:1;">${item.name}</div>
              <div style="font-size:14px; opacity:0.9;">#${item.id}</div>
            </div>
            
            <div style="margin-bottom:12px;">
              <div style="font-size:16px; font-weight:bold; margin-bottom:4px;">📦 Stock: <span style="color:#ffd700;">${item.stock}</span></div>
              <div style="font-size:16px; font-weight:bold;">🧮 Sold: <span style="color:#ffd700;">${item.orders}</span></div>
            </div>
            
            <div style="position:absolute; bottom:20px; left:20px; right:20px;">
              <input
                type="number"
                min="1"
                placeholder="+Stock"
                id="restock-${item.id}"
                style="width:70px; padding:8px; border:none; border-radius:8px; font-size:14px; margin-right:8px;"
              >
              <button onclick="restockItem(${item.id})" style="padding:8px 16px; border:none; border-radius:8px; background:rgba(255,255,255,0.2); color:white; font-weight:bold; cursor:pointer;">Add</button>
              <div style="margin-top:8px;">
                <button onclick="removeItem('${item.id}')" style="padding:6px 12px; border:none; border-radius:6px; background:rgba(255,100,100,0.3); color:white; font-size:12px; cursor:pointer;">Remove</button>
              </div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      
      ${
        sortedMenu.length > 3
          ? `
        <button id="menuPrev" class="box-arrow" style="position:absolute; top:50%; left:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">‹</button>
        <button id="menuNext" class="box-arrow" style="position:absolute; top:50%; right:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">›</button>
      `
          : ""
      }
    </div>`;

  // Initialize 3-card menu carousel
  if (sortedMenu.length > 1) {
    initAdminMenuCarousel(sortedMenu.length);
  }
}

let currentMenuIndex = 0;
let totalMenuItems = 0;

function initAdminMenuCarousel(itemCount) {
  totalMenuItems = itemCount;
  const VISIBLE_CARDS = 3;
  currentMenuIndex = 0;

  const track = document.getElementById("adminMenuTrack");
  const prevBtn = document.getElementById("menuPrev");
  const nextBtn = document.getElementById("menuNext");

  if (prevBtn) prevBtn.onclick = () => slideAdminMenuCarousel(-1);
  if (nextBtn) nextBtn.onclick = () => slideAdminMenuCarousel(1);

  // Swipe support
  let startX = 0;
  track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });
  track.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) slideAdminMenuCarousel(1);
    if (endX - startX > 50) slideAdminMenuCarousel(-1);
  });
}

function slideAdminMenuCarousel(direction) {
  const VISIBLE_CARDS = 3;
  const maxIndex = totalMenuItems - VISIBLE_CARDS;
  currentMenuIndex += direction;
  if (currentMenuIndex < 0) currentMenuIndex = 0;
  if (currentMenuIndex > maxIndex) currentMenuIndex = maxIndex;

  const track = document.getElementById("adminMenuTrack");
  track.style.transform = `translateX(-${currentMenuIndex * 33.333}%)`;
}

function loadAdminMenu() {
  const list = document.getElementById("adminMenu");
  list.innerHTML = "";

  list.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h3>Menu Items (${menu.length})</h3>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; max-width: 100%;">
      ${menu
        .map(
          (item) => `
        <div class="menu-card" style="
          height: 220px; 
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
          border-radius: 16px; 
          padding: 20px; 
          color: white; 
          box-shadow: 0 10px 30px rgba(79,172,254,0.3); 
          position: relative;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div style="font-size: 18px; font-weight: bold; flex: 1;">${item.name}</div>
            <div style="font-size: 14px; opacity: 0.9;">#${item.id}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">
              📦 Stock: <span style="color: #ffd700;">${item.stock}</span>
            </div>
            <div style="font-size: 16px; font-weight: bold;">
              🧮 Sold: <span style="color: #ffd700;">${item.orders}</span>
            </div>
          </div>
          
          <div style="position: absolute; bottom: 20px; left: 20px; right: 20px; display: flex; align-items: center; gap: 8px;">
  <input
    type="number"
    min="1"
    placeholder="+Stock"
    id="restock-${item.id}"
    style="width: 70px; padding: 8px; border: none; border-radius: 8px; font-size: 12px; flex-shrink: 0;"
  >
  <button onclick="restockItem(${item.id})" class="btn btn-primary" style="
    padding: 8px 16px; 
    border: none; 
    border-radius: 8px; 
    color: white; 
    font-weight: bold; 
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
  ">Add</button>
  <div style="flex: 1;"></div>
  <button onclick="removeItem('${item.id}')" style="
    padding: 6px 12px; 
    border: none; 
    border-radius: 6px; 
    background: rgba(252, 16, 16, 0.86); 
    color: white; 
    font-size: 12px; 
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
  ">Remove</button>
</div>
        </div>
      `,
        )
        .join("")}
    </div>`;

  // Re-attach live total calculation for restock inputs
  setTimeout(() => {
    document
      .querySelectorAll("#adminMenu input[type=number]")
      .forEach((input) => {
        input.oninput = calculateTotal;
      });
  }, 100);
}

// let currentAdminOrdersIndex = 0;
// let totalAdminOrders = 0;

// function initAdminOrdersCarousel(orderCount) {
//   totalAdminOrders = orderCount;
//   currentAdminOrdersIndex = 0;

//   const track = document.getElementById("adminOrdersTrack");
//   const prevBtn = document.getElementById("adminOrdersPrev");
//   const nextBtn = document.getElementById("adminOrdersNext");

//   if (prevBtn) prevBtn.onclick = () => slideAdminOrdersCarousel(-1);
//   if (nextBtn) nextBtn.onclick = () => slideAdminOrdersCarousel(1);

//   // Swipe support
//   let startX = 0;
//   track.addEventListener("touchstart", (e) => {
//     startX = e.touches[0].clientX;
//   });
//   track.addEventListener("touchend", (e) => {
//     const endX = e.changedTouches[0].clientX;
//     if (startX - endX > 50) slideAdminOrdersCarousel(1);
//     if (endX - startX > 50) slideAdminOrdersCarousel(-1);
//   });
// }

// function slideAdminOrdersCarousel(direction) {
//   const VISIBLE_BOXES = 3;
//   const maxIndex = totalAdminOrders - VISIBLE_BOXES;
//   currentAdminOrdersIndex += direction;
//   if (currentAdminOrdersIndex < 0) currentAdminOrdersIndex = 0;
//   if (currentAdminOrdersIndex > maxIndex) currentAdminOrdersIndex = maxIndex;

//   const track = document.getElementById("adminOrdersTrack");
//   track.style.transform = `translateX(-${currentAdminOrdersIndex * 33.333}%)`;
// }

function loadAdminOrderHistory() {
  const containerId = "adminOrderHistory";
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.marginTop = "20px";
    document.getElementById("adminPanel").appendChild(container);
  }

  const orders = window.allOrders || [];
  const completed = orders.filter((o) => o.status === "completed");

  if (completed.length === 0) {
    container.innerHTML = "<h3>No completed orders yet</h3>";
    return;
  }

  container.innerHTML =
    "<h2>Order History</h2>" +
    completed
      .map((o) => {
        // Map each item to a string like "2 x Pizza"
        const items = o.items
          .map((it) => `${it.qty} x ${it.name}`)
          .join("<br>");

        // Calculate total quantity for this order
        const totalQty = o.items.reduce((sum, it) => sum + it.qty, 0);
        return `
      <div class="card" style="padding:8px;margin-bottom:8px;opacity:0.85;">
        <strong>Order #${o.orderId}</strong> — ${new Date(o.timestamp).toLocaleString()}<br>
        ${o.user.name} | Total items: ${totalQty}
        <br>${items}</br>
        <button class="btn btn-primary print-receipt-btn" data-order-id="${o.orderId}">
              🖨️ Print
            </button>
      </div>
    `;
      })
      .join("");
  document.querySelectorAll(".print-receipt-btn").forEach((btn) => {
    btn.onclick = () => {
      const orderId = Number(btn.dataset.orderId);
      const order = orders.find((o) => o.orderId === orderId);

      if (!order) {
        console.error("Order not found for printing:", orderId);
        return;
      }

      const receiptHTML = generateReceiptHTML(order);
      printReceiptContent(receiptHTML);
    };
  });
}

function renderUserHistory() {
  const hist = window.userHistory || [];
  let container = document.getElementById("userHistory");
  if (!container) {
    container = document.createElement("div");
    container.id = "userHistory";
    container.style.marginTop = "20px";
    document.getElementById("userSection").appendChild(container);
  }

  if (hist.length === 0) {
    container.innerHTML = "<h3>Your Orders</h3><p>No previous orders.</p>";
    return;
  }

  // NEWEST FIRST
  const sortedHist = [...hist].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  );

  container.innerHTML = `
    <div style="margin-bottom: 15px;">
      <h3>Your Orders (${sortedHist.length})</h3>
    </div>
    
    <div id="userHistoryCarousel" class="box-carousel" style="position:relative; overflow:hidden; max-width:100%;">
      <div id="userHistoryTrack" class="carousel-track" style="display:flex; transition:transform 0.4s ease; gap:15px;">
        ${sortedHist
          .map((o) => {
            const items = o.items
              .map((it) => `${it.qty}x${it.name}`)
              .join("; ");
            const totalQty = o.items.reduce((sum, it) => sum + it.qty, 0);
            return `
            <div class="order-box" style="flex:0 0 calc(33.333% - 10px); height:180px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:12px; padding:15px; color:white; box-shadow:0 8px 25px rgba(0,0,0,0.15);">
              <div style="font-size:14px; font-weight:bold; margin-bottom:5px;">Order #${o.orderId}</div>
              <div style="font-size:14px; opacity:0.9; margin-bottom:8px;">${new Date(o.timestamp).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}</div>
              <div style="font-size:14px; margin-bottom:8px; line-height:1.3;font-weight:semibold">${items.substring(0, 35)}${items}</div>
              <div style="font-size:18px; font-weight:bold; color:#ffd700;">${totalQty} items</div>
            </div>`;
          })
          .join("")}
      </div>
      
      ${
        sortedHist.length > 3
          ? `
        <button id="userHistoryPrev" class="box-arrow" style="position:absolute; top:50%; left:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">‹</button>
        <button id="userHistoryNext" class="box-arrow" style="position:absolute; top:50%; right:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">›</button>
        <div id="userHistoryDots" style="text-align:center; margin-top:15px;"></div>
      `
          : ""
      }
    </div>`;

  // Initialize 3-box carousel
  if (sortedHist.length > 1) {
    initUserHistoryBoxCarousel(sortedHist.length);
  }
}

let currentUserHistoryIndex = 0;
let totalUserHistoryOrders = 0;

function initUserHistoryBoxCarousel(orderCount) {
  totalUserHistoryOrders = orderCount;
  const VISIBLE_BOXES = 3;
  currentUserHistoryIndex = 0;

  const track = document.getElementById("userHistoryTrack");
  const prevBtn = document.getElementById("userHistoryPrev");
  const nextBtn = document.getElementById("userHistoryNext");

  prevBtn.onclick = () => slideUserHistoryBoxCarousel(-1);
  nextBtn.onclick = () => slideUserHistoryBoxCarousel(1);

  // Swipe
  let startX = 0;
  track.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX));
  track.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) slideUserHistoryBoxCarousel(1);
    if (endX - startX > 50) slideUserHistoryBoxCarousel(-1);
  });
}

function slideUserHistoryBoxCarousel(direction) {
  const VISIBLE_BOXES = 3;
  const maxIndex = totalUserHistoryOrders - VISIBLE_BOXES;
  currentUserHistoryIndex += direction;
  if (currentUserHistoryIndex < 0) currentUserHistoryIndex = 0;
  if (currentUserHistoryIndex > maxIndex) currentUserHistoryIndex = maxIndex;

  const track = document.getElementById("userHistoryTrack");
  track.style.transform = `translateX(-${currentUserHistoryIndex * 33.333}%)`;
}

function loadAdminOrders() {
  const containerId = "adminOrders";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.marginTop = "20px";
    document.getElementById("adminPanel").appendChild(container);
  }

  const orders = window.allOrders || [];
  const query = (
    (document.getElementById("adminSearch") &&
      document.getElementById("adminSearch").value) ||
    ""
  )
    .toLowerCase()
    .trim();

  const filtered = orders.filter((o) => {
    if (!query) return true;
    if ((o.orderId + "").includes(query)) return true;
    if (
      (o.user && o.user.name && o.user.name.toLowerCase().includes(query)) ||
      (o.user && o.user.email && o.user.email.toLowerCase().includes(query))
    )
      return true;
    if (o.items && o.items.some((it) => it.name.toLowerCase().includes(query)))
      return true;
    return false;
  });

  const activeOrders = filtered.filter((o) => o.status !== "completed");
  if (activeOrders.length === 0) {
    container.innerHTML = "<h3>No active orders</h3>";
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = "<h3>No orders matching search</h3>";
    return;
  }

  // NEWEST FIRST
  const sortedActive = [...activeOrders].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
  );

  container.innerHTML = `
    <div style="margin-bottom: 15px;">
      <h3>Active Orders (${sortedActive.length})</h3>
    </div>
    
    <div id="adminOrdersCarousel" class="box-carousel" style="position:relative; overflow:hidden; max-width:100%;">
      <div id="adminOrdersTrack" class="carousel-track" style="display:flex; transition:transform 0.4s ease; gap:15px;">
        ${sortedActive
          .map((o) => {
            const items = o.items
              .map((it) => `${it.qty}x${it.name}`)
              .join(", ");
            const totalQty = o.items.reduce((sum, it) => sum + it.qty, 0);
            return `
            <div class="admin-order-box" style="
              flex: 0 0 calc(33.333% - 10px); 
              height: 240px; 
              background: linear-gradient(135deg, #ff6b6b, #ee5a24); 
              border-radius: 16px; 
              padding: 20px; 
              color: white; 
              box-shadow: 0 10px 30px rgba(255,107,107,0.3); 
              position: relative; 
              overflow: hidden;
            ">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="font-size:16px; font-weight:bold; flex:1;">Order #${o.orderId}</div>
                <div style="font-size:12px; opacity:0.9;">${new Date(o.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
              </div>
              <div style="font-size:14px; margin-bottom:8px;"><strong>${o.user?.name || "N/A"}</strong></div>
              <div style="font-size:13px; line-height:1.3; margin-bottom:8px; max-height:70px; overflow:hidden;">
                ${items}
              </div>
              
              
              <div style="font-size:20px; font-weight:bold; color:#ffd700; margin-bottom:8px;">${totalQty} items</div>
              
              <div style="position:absolute; bottom:20px; left:20px; right:20px; display:flex; gap:8px;">
                <button class="btn btn-primary print-receipt-btn" data-order-id="${o.orderId}" style="flex:1; padding:10px; font-size:13px; border-radius:8px;">🖨️ Print</button>
                <button class="btn btn-success complete-order-btn" data-order-id="${o.orderId}" style="flex:1; padding:10px; font-size:13px; border-radius:8px;">✅ Complete</button>
              </div>
            </div>`;
          })
          .join("")}
      </div>
      
      ${
        sortedActive.length > 3
          ? `
        <button id="adminOrdersPrev" class="box-arrow" style="position:absolute; top:50%; left:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">‹</button>
        <button id="adminOrdersNext" class="box-arrow" style="position:absolute; top:50%; right:15px; background:rgba(0,0,0,0.8); color:white; border:none; width:50px; height:50px; border-radius:50%; font-size:20px; cursor:pointer; transform:translateY(-50%); z-index:20;">›</button>
      `
          : ""
      }
    </div>`;

  // YOUR ORIGINAL EVENT HANDLERS (perfect!)
  document.querySelectorAll(".print-receipt-btn").forEach((btn) => {
    btn.onclick = () => {
      const orderId = Number(btn.dataset.orderId);
      const order = orders.find((o) => o.orderId === orderId);
      if (!order) {
        console.error("Order not found for printing:", orderId);
        return;
      }
      const receiptHTML = generateReceiptHTML(order);
      printReceiptContent(receiptHTML);
    };
  });

  document.querySelectorAll(".complete-order-btn").forEach((btn) => {
    btn.onclick = () => {
      const orderId = Number(btn.dataset.orderId);
      socket.emit("completeOrder", orderId);
    };
  });

  // Initialize carousel
  if (sortedActive.length > 1) {
    initAdminOrdersCarousel(sortedActive.length);
  }
}

let currentAdminOrdersIndex = 0;
let totalAdminOrders = 0;

function initAdminOrdersCarousel(orderCount) {
  totalAdminOrders = orderCount;
  currentAdminOrdersIndex = 0;

  const track = document.getElementById("adminOrdersTrack");
  const prevBtn = document.getElementById("adminOrdersPrev");
  const nextBtn = document.getElementById("adminOrdersNext");

  if (prevBtn) prevBtn.onclick = () => slideAdminOrdersCarousel(-1);
  if (nextBtn) nextBtn.onclick = () => slideAdminOrdersCarousel(1);

  // Swipe
  let startX = 0;
  track.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });
  track.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    if (startX - endX > 50) slideAdminOrdersCarousel(1);
    if (endX - startX > 50) slideAdminOrdersCarousel(-1);
  });
}

function slideAdminOrdersCarousel(direction) {
  const VISIBLE_BOXES = 3;
  const maxIndex = totalAdminOrders - VISIBLE_BOXES;
  currentAdminOrdersIndex += direction;
  if (currentAdminOrdersIndex < 0) currentAdminOrdersIndex = 0;
  if (currentAdminOrdersIndex > maxIndex) currentAdminOrdersIndex = maxIndex;

  const track = document.getElementById("adminOrdersTrack");
  track.style.transform = `translateX(-${currentAdminOrdersIndex * 33.333}%)`;
}

function showReceipt(order) {
  // simple popup-style receipt
  const receipt = document.createElement("div");
  const totalQty = order.items.reduce((sum, it) => sum + it.qty, 0);
  receipt.className = "card";
  receipt.style.position = "fixed";
  receipt.style.left = "50%";
  receipt.style.top = "10%";
  receipt.style.transform = "translateX(-50%)";
  receipt.style.zIndex = 2000;
  receipt.style.maxWidth = "600px";
  receipt.innerHTML = `
    <h3>Receipt — Order #${order.orderId}</h3>
    <p><strong>${order.user.name}</strong> &lt;${order.user.email}&gt;</p>
    <div>${order.items.map((it) => `<div>${it.qty} x ${it.name}</div>`).join("")}</div>
    <h4>Total Items: ${totalQty}</h4>
    <div style="margin-top:10px">
      <button class="btn btn-secondary" id="closeReceipt">Close</button>
    </div>
  `;
  document.body.appendChild(receipt);
  document.getElementById("closeReceipt").onclick = () => {
    receipt.remove();
  };
}

function printReceiptContent(html) {
  const w = window.open("", "_blank");
  w.document.write("<html><head><title>Receipt</title>");
  w.document.write('<link rel="stylesheet" href="style.css">');
  w.document.write("</head><body>");
  w.document.write(html);
  w.document.write("</body></html>");
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 500);
}

function generateReceiptHTML(order) {
  const itemsHTML = order.items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>₹${item.price}</td>
      <td>₹${item.price * item.qty}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <div class="receipt">
      <h2>📚 College Stationery Store</h2>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Name:</strong> ${order.user.name}</p>
      <p><strong>Email:</strong> ${order.user.email}</p>
      <p><strong>Date:</strong> ${new Date(order.timestamp).toLocaleString()}</p>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <h3>Total: ₹${order.total}</h3>

      <p class="thank-you">Thank you for shopping with us 🙏</p>
    </div>
  `;
}
function getThisMonthSales() {
  const d = new Date();
  socket.emit("getSalesReport", {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  });
}

function getThisYearSales() {
  socket.emit("getSalesReport", {
    year: new Date().getFullYear(),
  });
}

/* PWA */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then((registration) => {
      console.log("Service Worker registered");

      // Check for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New version available
            showUpdateNotification();
          }
        });
      });

      // If there's already a waiting service worker, show update prompt
      if (registration.waiting) {
        showUpdateNotification();
      }
    })
    .catch((error) => {
      console.log("Service Worker registration failed:", error);
    });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      window.location.reload();
    }
    if (event.data && event.data.type === "REFRESH_PAGE") {
      console.log("Service worker updated, refreshing page...");
      window.location.reload();
    }
  });
}

function showUpdateNotification() {
  const notification = document.getElementById("notification");
  notification.textContent = "New version available! Click to update.";
  notification.className = "notification update";
  notification.style.display = "block";
  notification.style.cursor = "pointer";
  notification.onclick = () => {
    // Tell the service worker to skip waiting
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  };

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (notification.className.includes("update")) {
      notification.style.display = "none";
    }
  }, 10000);
}
