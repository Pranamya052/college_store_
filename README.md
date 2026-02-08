# 📚📦 College Mini stationery store 

A modern, real-time Progressive Web App (PWA) for college stationery store ordering with live order tracking.

## ✨ Features

- **👤 User Ordering**: Simple interface to browse menu and place orders
- **👨‍💼 Admin Dashboard**: Password-protected admin panel to manage menu and track orders
- **🔄 Real-time Updates**: Live order counts across all devices using Socket.io
- **📱 PWA**: Installable app, works offline, push notifications
- **💰 Live Total Calculation**: Automatic price calculation as you select items
- **🎨 Modern UI**: Beautiful gradient design with smooth animations

## 🚀 Quick Start

### Prerequisites
- Node.js (version 16 or higher)
- Git
- A web browser

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rayif18/college-stationery store.git
   cd college-stationery store
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   - Go to `http://localhost:3000`
   - The app will load automatically

## 📖 How to Use

### For Students (Users):
1. Click **"Login as User"**
2. Browse the menu items
3. Enter quantities for items you want
4. Watch the **books orders update automatically**
5. Click **"Place Order 🛒"** when ready
6. See success confirmation

### For Store Staff (Admins):
1. Click **"Login as Admin"**
2. Enter password: `store 2026`
3. **Add new items**: Enter name and price, click "Add Item"
4. **Monitor orders**: See live order counts for each item
5. **Remove items**: Click "Remove" next to any item
6. **Real-time updates**: Order counts update instantly from user orders

## 🏗️ Project Structure

```
college-canteen/
├── index.html          # Main HTML page
├── script.js           # Client-side JavaScript
├── style.css           # CSS styles
├── server.js           # Node.js server
├── service-worker.js   # PWA service worker
├── manifest.json       # PWA manifest
├── package.json        # Dependencies
└── README.md          # This file
```

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **PWA**: Service Worker, Web App Manifest
- **Styling**: Google Fonts, CSS Gradients, Flexbox

## 📦 Dependencies

- `express`: Web server framework
- `socket.io`: Real-time bidirectional communication

## 🚀 Deployment

### Option 1: Railway (Recommended)
1. Push code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Connect your GitHub repo
4. Deploy automatically

### Option 2: Render
1. Push code to GitHub
2. Go to [Render.com](https://render.com)
3. Create new Web Service
4. Connect GitHub repo
5. Set build command: `npm install`
6. Set start command: `npm start`

### Option 3: Local Deployment
- Run `npm start` on your server
- Access via your server's IP address

## 🔧 Customization

### Change Admin Password
Edit `script.js`:
```javascript
const ADMIN_PASSWORD = "your_new_password";
```

### Add Default Menu Items
Edit `server.js` in the `menu` array:
```javascript
let menu = [
  { id: 1, name: "Your Item", price: 50, orders: 0 },
  // Add more items...
];
```

### Modify Styling
Edit `style.css` to change colors, fonts, or layout.

## 🐛 Troubleshooting

### App not updating in browser?
- **Clear browser cache** or use incognito mode
- The app uses PWA caching - updates may take a refresh

### Orders not updating?
- Check browser console for errors
- Ensure server is running on port 3000

### Can't connect to server?
- Verify Node.js is installed: `node --version`
- Check if port 3000 is available
- Try different port in `server.js`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Open an issue on GitHub
3. Include your error messages and steps to reproduce

---

**Happy ordering! 🍕🎉**# college_store_
