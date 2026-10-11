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

// Middleware
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

// Track socket to username mapping
const socketUserMap = new Map();

gameEngine.onPlayerDeath = async (player) => {
  const username = socketUserMap.get(player.id) || player.name;
  if (username) {
    console.log(`[Neon DB] Saving match stats for ${username}: Score ${player.size}, Gold +${player.gold}, Dice +${player.diceCount}`);
    await db.saveUserMatch(username, {
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

  // Fetch or sync user profile
  socket.on('syncUserProfile', async (data) => {
    const username = (data && data.name) ? String(data.name).trim().substring(0, 30) : 'Mèo';
    const user = await db.getOrCreateUser(username);
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

  // Save Shop purchases or Gacha Dice rolls to Cloud
  socket.on('updateCloudInventory', async (data) => {
    const username = (data && data.username) ? String(data.username).trim().substring(0, 30) : null;
    if (username) {
      await db.updateUserInventory(username, {
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

    socketUserMap.set(socket.id, name);

    // Ensure user exists in database
    await db.getOrCreateUser(name);

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

server.listen(PORT, () => {
  console.log(`🐾 =========================================`);
  console.log(`🐱 Meow.io Server running on http://localhost:${PORT}`);
  console.log(`✨ Mode: ONLINE (Pure Real Players) + Neon Cloud DB`);
  console.log(`🐾 =========================================`);
});
