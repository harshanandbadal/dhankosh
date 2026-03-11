// =========================================================
// DHANKOSH TERMINAL — server.js
// Express Backend: Auth, Dashboard State API, Static Files
// =========================================================

'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dhankosh_fallback_secret';

// ─── MIDDLEWARE ────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from project root (parent of backend/)
app.use(express.static(path.join(__dirname, '..')));

// ─── MONGODB CONNECTION ───────────────────────────────────

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!process.env.MONGODB_URI) {
    console.error('[ SYSTEM ERROR ] MONGODB_URI environment variable is missing.');
    throw new Error('Database connection string is missing.');
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[ SYSTEM ACTIVE : DATABASE CONNECTED ]');
    cachedDb = db;
    return db;
  } catch (err) {
    console.error('[ SYSTEM WARNING : DATABASE CONNECTION FAILED ]');
    console.error('  Error:', err.message);
    throw err;
  }
}

// Global middleware to ensure database connection before API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    try {
      await connectToDatabase();
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Database connection failed. Check Vercel Environment Variables.' });
    }
  } else {
    next();
  }
});

// ─── MODELS ───────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

const dashboardStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  banks: { type: mongoose.Schema.Types.Mixed, default: {} },
  credit: { type: mongoose.Schema.Types.Mixed, default: {} },
  budgets: { type: mongoose.Schema.Types.Mixed, default: [] },
  customers: { type: mongoose.Schema.Types.Mixed, default: [] },
  p2p: { type: mongoose.Schema.Types.Mixed, default: [] },
  transactions: { type: mongoose.Schema.Types.Mixed, default: [] },
  notifications: { type: mongoose.Schema.Types.Mixed, default: [] },
  updatedAt: { type: Date, default: Date.now },
});

const DashboardState = mongoose.model('DashboardState', dashboardStateSchema);

// ─── AUTH MIDDLEWARE ───────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── AUTH ROUTES ──────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    await user.save();

    // Create default dashboard state for the new user
    const defaultState = new DashboardState({
      userId: user._id,
      banks: { airtel: 0, bob: 0, jupiter: 0, ubi: 0, slice: 0, cash: 0 },
      credit: { amazon: 0, coral: 0, flipkart: 0, supermoney: 0, kiwi: 0 },
      budgets: [],
      customers: [],
      p2p: [],
      transactions: [],
      notifications: [],
    });
    await defaultState.save();

    console.log(`[ USER REGISTERED : ${email} ]`);
    res.status(201).json({ message: 'Account created successfully' });

  } catch (err) {
    console.error('Registration error:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[ USER LOGIN : ${user.email} ]`);
    res.json({
      token,
      username: user.username,
      email: user.email,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user info
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DASHBOARD STATE ROUTES ──────────────────────────────

// Get dashboard state
app.get('/api/state', authMiddleware, async (req, res) => {
  try {
    let stateDoc = await DashboardState.findOne({ userId: req.userId }).lean();

    if (!stateDoc) {
      // Create default state if none exists
      const newState = new DashboardState({
        userId: req.userId,
        banks: { airtel: 0, bob: 0, jupiter: 0, ubi: 0, slice: 0, cash: 0 },
        credit: { amazon: 0, coral: 0, flipkart: 0, supermoney: 0, kiwi: 0 },
        budgets: [],
        customers: [],
        p2p: [],
        transactions: [],
        notifications: [],
      });
      await newState.save();
      stateDoc = newState.toObject();
    }

    // Return only the data fields (not _id, __v, userId)
    res.json({
      banks: stateDoc.banks || {},
      credit: stateDoc.credit || {},
      budgets: stateDoc.budgets || [],
      customers: stateDoc.customers || [],
      p2p: stateDoc.p2p || [],
      transactions: stateDoc.transactions || [],
      notifications: stateDoc.notifications || [],
    });

  } catch (err) {
    console.error('Get state error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard state' });
  }
});

// Save dashboard state
app.put('/api/state', authMiddleware, async (req, res) => {
  try {
    const { banks, credit, budgets, customers, p2p, transactions, notifications } = req.body;

    await DashboardState.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          banks: banks || {},
          credit: credit || {},
          budgets: budgets || [],
          customers: customers || [],
          p2p: p2p || [],
          transactions: transactions || [],
          notifications: notifications || [],
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'State saved successfully', updatedAt: new Date() });

  } catch (err) {
    console.error('Save state error:', err.message);
    res.status(500).json({ error: 'Failed to save dashboard state' });
  }
});

// ─── START SERVER ─────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗`);
    console.log(`  ║  DHANKOSH TERMINAL SERVER              ║`);
    console.log(`  ║  Port: ${PORT}                            ║`);
    console.log(`  ║  URL:  http://localhost:${PORT}           ║`);
    console.log(`  ╚═══════════════════════════════════════╝\n`);
  });
}

module.exports = app;
