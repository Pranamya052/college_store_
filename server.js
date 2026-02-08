const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

const defaultMenu = [
  {
    id: 1,
    name: "Long book - 100pg (Ruled)",
    stock: 100,
    orders: 0,
  },
  { id: 2, name: "Long book - 200pg (Ruled)", stock: 80, orders: 0 },
  { id: 3, name: "King size - 100pg (Ruled)", stock: 90, orders: 0 },
  { id: 4, name: "King size - 200pg (Ruled)", stock: 60, orders: 0 },
  {
    id: 5,
    name: "Long book - 100pg (Unruled)",
    stock: 120,
    orders: 0,
  },
  {
    id: 6,
    name: "Long book - 200pg (Unruled)",
    stock: 70,
    orders: 0,
  },
  {
    id: 7,
    name: "King size - 100pg (Unruled)",
    stock: 85,
    orders: 0,
  },
  {
    id: 8,
    name: "King size - 200pg (Unruled)",
    stock: 55,
    orders: 0,
  },
  { id: 9, name: "Rough workbook", stock: 150, orders: 0 },
];

// Default data
let data = {
  nextOrderId: 1,
  users: [],
  orders: [],
  menu: defaultMenu,
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      saveData();
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const saved = JSON.parse(raw);

    data = {
      ...data, // keep defaults
      ...saved, // overwrite saved fields
      menu: Array.isArray(saved.menu) ? saved.menu : data.menu,
    };

    console.log("Loaded data from", DATA_FILE);
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving data:", err);
  }
}

function getSalesReport({ year, month } = {}) {
  const report = {};

  data.orders.forEach((order) => {
    const date = new Date(order.timestamp);
    const orderYear = date.getFullYear();
    const orderMonth = date.getMonth() + 1; // 1–12

    // filter by year/month if provided
    if (year && orderYear !== year) return;
    if (month && orderMonth !== month) return;

    order.items.forEach((item) => {
      if (!report[item.id]) {
        report[item.id] = {
          itemId: item.id,
          name: item.name,
          totalQty: 0,
          totalRevenue: 0,
        };
      }

      report[item.id].totalQty += item.qty;
      report[item.id].totalRevenue += item.qty * item.price;
    });
  });

  return Object.values(report);
}

loadData();

app.use(express.static("."));
app.use(express.static('images'));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  console.log("📦 Server menu value:", data.menu);
  console.log("📦 Is array?", Array.isArray(data.menu));
  // Send current menu and orders to new client
  socket.emit("menuUpdate", data.menu);
  socket.emit("ordersUpdate", data.orders);

  socket.on("getSalesReport", ({ year, month }) => {
    const report = getSalesReport({ year, month });
    socket.emit("salesReport", report);
  });

  // Register user login (stores user if new)
  socket.on("userLogin", (user) => {
    if (!user || !user.email) return;
    const email = user.email.toLowerCase();
    const exists = data.users.find((u) => u.email === email);
    if (!exists) {
      // create user with token
      const token =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      data.users.push({ name: user.name, email, token });
      saveData();
      user.token = token;
    } else {
      // ensure user has token
      if (!exists.token) {
        exists.token =
          Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        saveData();
      }
      user.token = exists.token;
    }
    // Add socket to a room for this user so we can push updates to all their devices
    socket.join(`user:${email}`);
    console.log("User logged in and joined room:", email);
    // Send current history immediately
    const history = data.orders.filter((o) => o.user && o.user.email === email);
    socket.emit("userHistory", history);
    // send back user data and token for client persistence
    socket.emit("userLogged", {
      user: { name: user.name, email },
      token: user.token,
    });
  });

  socket.on("resumeSession", (token) => {
    if (!token) return;
    const u = data.users.find((x) => x.token === token);
    if (!u) return;
    const email = u.email;
    socket.join(`user:${email}`);
    const history = data.orders.filter((o) => o.user && o.user.email === email);
    socket.emit("sessionResumed", {
      user: { name: u.name, email: u.email },
      history,
    });
  });

  socket.on("requestUserHistory", (email) => {
    if (!email) return;
    const history = data.orders.filter(
      (o) => o.user && o.user.email === email.toLowerCase(),
    );
    socket.emit("userHistory", history);
  });

  // Handle place order with user info
  socket.on("placeOrder", (payload) => {
    // payload expected: { items: [{id,qty}], user: {name,email}, total }
    try {
      const { items, user } = payload || {};
      if (!items || !Array.isArray(items) || !user) return;

      let total = 0;
      const itemDetails = [];

      // 🔍 FIRST PASS: validate stock
      for (const it of items) {
        const menuItem = data.menu.find((m) => m.id === parseInt(it.id));
        const qty = Number(it.qty) || 0;

        if (!menuItem) {
          socket.emit("orderError", {
            message: "Invalid item selected",
          });
          return;
        }

        if (qty <= 0) continue;

        if (menuItem.stock < qty) {
          socket.emit("orderError", {
            message: `Not enough stock for "${menuItem.name}". Available: ${menuItem.stock}`,
          });
          return;
        }
      }

      // ✅ SECOND PASS: deduct stock & build order
      for (const it of items) {
        const menuItem = data.menu.find((m) => m.id === parseInt(it.id));
        const qty = Number(it.qty) || 0;
        if (qty <= 0) continue;

        const price = menuItem.price;

        // deduct stock & increase sold count
        menuItem.stock -= qty;
        menuItem.orders += qty;

        total += price * qty;

        itemDetails.push({
          id: menuItem.id,
          name: menuItem.name,
          price,
          qty,
        });
      }
      const order = {
        orderId: data.nextOrderId++,
        user: { name: user.name, email: user.email.toLowerCase() },
        items: itemDetails,
        total,
        status: "active",
        timestamp: new Date().toISOString(),
      };

      data.orders.unshift(order);
      saveData();

      // Notify ordering client with receipt
      socket.emit("orderConfirmed", order);

      // Broadcast updates
      io.emit("menuUpdate", data.menu);
      io.emit("ordersUpdate", data.orders);

      // Push updated history to all devices of this user (room)
      io.to(`user:${order.user.email}`).emit(
        "userHistory",
        data.orders.filter((o) => o.user.email === order.user.email),
      );

      console.log("Order placed:", order.orderId);
    } catch (err) {
      console.error("Error processing order:", err);
    }
  });

  // Handle add item
  socket.on("addItem", (item) => {
    console.log("Received addItem:", item);
    const newId = data.menu.reduce((max, it) => Math.max(max, it.id), 0) + 1;
    const newItem = {
      id: newId,
      name: item.name,
      stock: item.stock,
      orders: 0,
    };
    data.menu.push(newItem);
    saveData();
    io.emit("menuUpdate", data.menu);
  });

  socket.on("completeOrder", (orderId) => {
    const order = data.orders.find((o) => o.orderId === Number(orderId));
    if (!order) return;

    order.status = "completed";
    saveData();

    io.emit("ordersUpdate", data.orders);

    console.log("✅ Order completed:", orderId);
  });

  socket.on("restockItem", ({ id, qty }) => {
    const item = data.menu.find((m) => m.id === Number(id));
    if (!item) return;

    item.stock += Number(qty);
    saveData();

    io.emit("menuUpdate", data.menu);

    console.log(`📦 Restocked ${item.name}: +${qty}`);
  });

  // Handle remove item
  socket.on("removeItem", (id) => {
    console.log("Received removeItem:", id);
    data.menu = data.menu.filter((item) => item.id !== parseInt(id));
    saveData();
    io.emit("menuUpdate", data.menu);
  });

  socket.on("getSalesReport", ({ year, month }) => {
    const report = getSalesReport({ year, month });
    socket.emit("salesReport", report);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
