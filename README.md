<div align="center">

<img src="logo/DhanKosh-logo.png" alt="DhanKosh Logo" width="120"/>

# DHANKOSH
### The Private Wealth Repository

[![Live Demo](https://img.shields.io/badge/Live-dhankosh.vercel.app-00e5ff?style=for-the-badge&logo=vercel&logoColor=black)](https://dhankosh.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

*A terminal-aesthetic personal finance dashboard for Indians — track banks, credit lines, budgets, customers & net wealth in one private repository.*

</div>

---

## Overview

DhanKosh is a full-stack personal finance management application with a **high-fidelity terminal interface**. It allows individuals to privately track their complete financial picture — from bank account balances and credit card outstanding to spending budgets and personal loans — all synced securely to the cloud.

Built with vanilla HTML/CSS/JS on the frontend and an Express + MongoDB backend, it is deployed as a serverless application on Vercel.

---

## Features

| Module | Description |
|---|---|
| 🏦 **Bank Accounts** | Add and manage multiple bank accounts. Track balances updated in real-time with every transaction. |
| 💳 **Credit Lines** | Add credit cards with limits and link them to bank accounts. Monitor outstanding balances and available credit. |
| 📊 **Spents & Budgets** | Create custom spending budgets with limits. Track utilisation and available limits via color-coded status indicators. |
| 👥 **Customer Ledger** | Manual ledger for personal lending. Track "You Gave" and "You Got" records linked to your central transaction history. |
| ⚡ **Net Wealth Hub** | Instant overview of total net wealth (assets minus liabilities). Set a personal wealth target and monitor the required amount to reach it. |
| 📜 **Transaction Ledger** | Universal record-keeping for all transactions. Supports full-text search, filtering by date/type/account, and delete with confirmation. |
| 📈 **Net Growth Chart** | 7-day net wealth chart powered by Chart.js. Displays percentage growth/decline at a glance. |
| ☁️ **Cloud Sync** | All data is persisted per-user to MongoDB Atlas via a secure REST API, with JWT-based authentication. |
| 🖨️ **Financial Reports** | Generate and print a professional account statement (printable HTML page) with a single click. |
| 🔔 **Notifications** | In-dashboard notification center for financial alerts and updates. |

---

## Tech Stack

### Frontend
- **HTML5** — Semantic structure across all pages (`index`, `login`, `signup`, `dashboard`, `print`)
- **Vanilla CSS** — Custom design system with CSS variables; dark terminal aesthetic using `Fira Code` (mono) and `Rajdhani` (display) fonts from Google Fonts
- **Vanilla JavaScript** — All UI logic, state management, API calls, and Chart.js integration in `js/script.js`
- **Chart.js** (CDN) — Net growth chart visualization

### Backend
- **Node.js + Express** — REST API server (`backend/server.js`)
- **Mongoose** — MongoDB ODM for `User` and `DashboardState` schemas
- **bcryptjs** — Password hashing (salt rounds: 10)
- **jsonwebtoken** — JWT auth with 7-day token expiry
- **dotenv** — Environment variable management
- **CORS** — Cross-origin support for static frontend

### Database
- **MongoDB Atlas** — Cloud-hosted NoSQL database. Each user has a single `DashboardState` document storing all their `banks`, `credit`, `budgets`, `customers`, `transactions`, and `notifications` arrays.

### Deployment
- **Vercel** — Serverless deployment. The Express backend runs as a `@vercel/node` function; all static assets (HTML, CSS, JS, images) are served as `@vercel/static`.

---

## Project Structure

```
DhanKosh/
├── index.html              # Landing page with feature showcase & auth CTAs
├── pages/
│   ├── dashboard.html      # Main financial dashboard
│   ├── login.html          # Login page
│   ├── signup.html         # Registration page
│   └── print.html          # Printable account statement
├── css/
│   ├── style.css           # Main stylesheet (design system + all components)
│   └── print.css           # Print-specific styles
├── js/
│   ├── script.js           # Core dashboard logic (~82KB)
│   ├── login.js            # Login flow
│   ├── signup.js           # Registration flow
│   └── print.js            # Statement generation
├── logo/
│   ├── DhanKosh-logo.png   # App logo (icon)
│   └── DhanKosh.png        # Full brand image
├── backend/
│   ├── server.js           # Express API server
│   ├── package.json        # Backend dependencies
│   └── .env                # Environment variables (not committed)
├── package.json            # Root package (start script)
├── vercel.json             # Vercel build & routing configuration
└── .gitignore
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register a new user account |
| `POST` | `/api/auth/login` | ❌ | Login and receive a JWT token |
| `GET` | `/api/auth/me` | ✅ Bearer | Get current authenticated user info |
| `GET` | `/api/state` | ✅ Bearer | Load the user's full dashboard state |
| `PUT` | `/api/state` | ✅ Bearer | Save (upsert) the user's dashboard state |

All protected routes require an `Authorization: Bearer <token>` header.

---

## Getting Started

### Prerequisites
- Node.js v18+
- A MongoDB Atlas cluster (or local MongoDB instance)

### Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/harshanandbadal/dhankosh.git
   cd dhankosh
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables**

   Create `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
   JWT_SECRET=your_strong_jwt_secret_here
   PORT=3000
   ```

4. **Start the backend server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

5. **Open the frontend**

   Navigate to `http://localhost:3000` in your browser. The Express server serves all static files from the project root.

---

## Deployment (Vercel)

The app is pre-configured for Vercel via `vercel.json`:

- `backend/server.js` → deployed as a serverless Node.js function
- All `*.html`, `css/**`, `js/**`, `logo/**` → deployed as static assets
- API requests to `/api/*` are routed to the backend function
- All other requests are routed to their static file

To deploy your own instance:
```bash
npm install -g vercel
vercel --prod
```

Set `MONGODB_URI` and `JWT_SECRET` as environment variables in your Vercel project settings.

---

## Data Model

**User**
```js
{
  username: String,   // min 3 chars
  email: String,      // unique, lowercase
  password: String,   // bcrypt hashed
  createdAt: Date
}
```

**DashboardState** *(one per user)*
```js
{
  userId: ObjectId,       // ref: User
  banks: Array,           // bank account objects
  credit: Array,          // credit card objects
  budgets: Array,         // budget objects
  customers: Array,       // customer ledger entries
  transactions: Array,    // full transaction history
  notifications: Array,   // notification items
  updatedAt: Date
}
```

---

## Design System

The UI follows a **terminal / cyberpunk aesthetic**:
- **Background**: Deep dark (`#0a0a0f`)
- **Primary Accent**: Cyan (`#00e5ff`)
- **Secondary Accent**: Gold (`#ffc400`)
- **Fonts**: `Fira Code` for monospace elements, `Rajdhani` for display headings
- **Animations**: `fadeInScale`, `slideDown`, `slideUp`, `logoGlow` keyframes on landing page; smooth hover transitions throughout the dashboard

---

## License

© 2026 DhanKosh. All Rights Reserved. — **Harsh Anand**