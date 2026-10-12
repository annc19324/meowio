require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameEngine = require('./game/GameEngine');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Initialize Neon Database
db.initDB().then(connected => {
  if (connected) {
    console.log('🐾 [Neon DB] Connected & ready for persistent user profiles!');
  }
});

// Middleware & CORS for Cross-Origin Deployment (e.g. Vercel Frontend -> Render Backend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Global Leaderboard API
app.get('/api/hall-of-fame', async (req, res) => {
  const topPlayers = await db.getGlobalLeaderboard();
  res.json({ success: true, leaderboard: topPlayers });
});

// Authentication APIs (Đăng Ký & Đăng Nhập)
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  const result = await db.registerUser(username, email, password);
  res.json(result);
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  const result = await db.loginUser(identifier, password);
  res.json(result);
});

// Initialize Game Engine (Online mode = Only Real Players, zero bots)
const gameEngine = new GameEngine(io);

// Track socket to authenticated username mapping (null for guests)
const socketUserMap = new Map();

gameEngine.onPlayerDeath = async (player) => {
  const accountUsername = socketUserMap.get(player.id);
  // Only save match rewards to database for registered/logged-in users!
  // Guests have their gold/dice saved directly in their device's localStorage.
  if (accountUsername) {
    console.log(`[Neon DB] Saving match stats for logged-in user ${accountUsername}: Score ${player.size}, Gold +${player.gold}, Dice +${player.diceCount}`);
    await db.saveUserMatch(accountUsername, {
      score: player.size,
      goldEarned: player.gold,
      diceEarned: player.diceCount
    });
  }
};

io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id}`);

  // Auth via Socket
  socket.on('register', async (data, callback) => {
    const result = await db.registerUser(data.username, data.email, data.password);
    if (typeof callback === 'function') callback(result);
  });

  socket.on('login', async (data, callback) => {
    const result = await db.loginUser(data.identifier, data.password);
    if (typeof callback === 'function') callback(result);
  });

  // Fetch or sync user profile (ONLY for authenticated logged-in accounts)
  socket.on('syncUserProfile', async (data) => {
    const accountUsername = (data && data.accountUsername) ? String(data.accountUsername).trim().substring(0, 30) : null;
    if (!accountUsername) return; // Ignore for guests

    const user = await db.getOrCreateUser(accountUsername);
    if (user) {
      socket.emit('userProfileSynced', {
        username: user.username,
        gold: user.gold,
        dice: user.dice,
        unlockedSkins: user.unlocked_skins,
        selectedSkin: user.selected_skin,
        highScore: user.high_score,
        totalKills: user.total_kills
      });
    }
  });

  // Save Shop purchases or Gacha Dice rolls to Cloud (ONLY for authenticated accounts)
  socket.on('updateCloudInventory', async (data) => {
    const accountUsername = (data && data.accountUsername) ? String(data.accountUsername).trim().substring(0, 30) : null;
    if (accountUsername) {
      await db.updateUserInventory(accountUsername, {
        gold: data.gold,
        dice: data.dice,
        unlockedSkins: data.unlockedSkins,
        selectedSkin: data.selectedSkin
      });
    }
  });

  socket.on('joinGame', async (data) => {
    const name = (data && data.name) ? String(data.name).trim().substring(0, 16) : 'Mèo';
    const skin = (data && data.skin) ? String(data.skin) : 'white';
    const accountUsername = (data && data.accountUsername) ? String(data.accountUsername).trim().substring(0, 30) : null;

    if (accountUsername) {
      socketUserMap.set(socket.id, accountUsername);
    } else {
      socketUserMap.delete(socket.id); // Guest: no database connection
    }

    const player = gameEngine.addPlayer(socket.id, name, skin);
    socket.emit('gameJoined', {
      playerId: socket.id,
      mapSize: gameEngine.mapSize,
      player: player.toJSON()
    });
  });

  socket.on('input', (inputData) => {
    if (inputData) {
      gameEngine.handlePlayerInput(socket.id, inputData);
    }
  });

  socket.on('surrender', () => {
    const player = gameEngine.players.get(socket.id);
    if (player && player.alive) {
      player.alive = false;
      player.hasHandledDeath = true;
      gameEngine.dropDeathLoot(player);
      if (typeof gameEngine.onPlayerDeath === 'function') {
        gameEngine.onPlayerDeath(player);
      }
      socket.emit('gameOver', {
        score: player.size,
        goldEarned: player.gold,
        diceEarned: player.diceCount,
        isSurrendered: true
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id}`);
    gameEngine.removePlayer(socket.id);
    socketUserMap.delete(socket.id);
  });
});

// Health Check endpoint for Render / Cloud port scanners
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`🐾 =========================================`);
  console.log(`🐱 Meow.io Server running on http://${HOST}:${PORT}`);
  console.log(`✨ Mode: ONLINE (Pure Real Players) + Neon Cloud DB`);
  console.log(`🐾 =========================================`);
});
