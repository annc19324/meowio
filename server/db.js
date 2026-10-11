require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL successfully!');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        gold INT DEFAULT 150,
        dice INT DEFAULT 3,
        unlocked_skins JSONB DEFAULT '["white", "orange"]'::jsonb,
        selected_skin VARCHAR(30) DEFAULT 'white',
        high_score INT DEFAULT 100,
        total_kills INT DEFAULT 0,
        games_played INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" verified/created!');

    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
}

// User helper methods
async function getOrCreateUser(username) {
  const cleanName = String(username).trim().substring(0, 30) || 'Mèo Ẩn Danh';
  try {
    let res = await pool.query('SELECT * FROM users WHERE username = $1', [cleanName]);
    if (res.rows.length === 0) {
      // Create new user
      res = await pool.query(`
        INSERT INTO users (username, gold, dice, unlocked_skins, selected_skin, high_score)
        VALUES ($1, 150, 3, '["white", "orange"]'::jsonb, 'white', 100)
        RETURNING *
      `, [cleanName]);
    } else {
      // Update last seen
      await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE username = $1', [cleanName]);
    }
    return res.rows[0];
  } catch (err) {
    console.error('Database getOrCreateUser error:', err.message);
    return null;
  }
}

async function saveUserMatch(username, { goldEarned = 0, diceEarned = 0, score = 100, kills = 0, unlockedSkins = null, selectedSkin = null }) {
  const cleanName = String(username).trim().substring(0, 30);
  try {
    const query = `
      UPDATE users
      SET 
        gold = gold + $1,
        dice = dice + $2,
        high_score = GREATEST(high_score, $3),
        total_kills = total_kills + $4,
        games_played = games_played + 1,
        unlocked_skins = COALESCE($5::jsonb, unlocked_skins),
        selected_skin = COALESCE($6, selected_skin),
        last_seen = CURRENT_TIMESTAMP
      WHERE username = $7
      RETURNING *;
    `;
    const res = await pool.query(query, [
      goldEarned,
      diceEarned,
      score,
      kills,
      unlockedSkins ? JSON.stringify(unlockedSkins) : null,
      selectedSkin,
      cleanName
    ]);
    return res.rows[0];
  } catch (err) {
    console.error('Database saveUserMatch error:', err.message);
    return null;
  }
}

async function updateUserInventory(username, { gold, dice, unlockedSkins, selectedSkin }) {
  const cleanName = String(username).trim().substring(0, 30);
  try {
    const query = `
      UPDATE users
      SET
        gold = COALESCE($1, gold),
        dice = COALESCE($2, dice),
        unlocked_skins = COALESCE($3::jsonb, unlocked_skins),
        selected_skin = COALESCE($4, selected_skin),
        last_seen = CURRENT_TIMESTAMP
      WHERE username = $5
      RETURNING *;
    `;
    const res = await pool.query(query, [
      gold !== undefined ? gold : null,
      dice !== undefined ? dice : null,
      unlockedSkins ? JSON.stringify(unlockedSkins) : null,
      selectedSkin || null,
      cleanName
    ]);
    return res.rows[0];
  } catch (err) {
    console.error('Database updateUserInventory error:', err.message);
    return null;
  }
}

async function getGlobalLeaderboard() {
  try {
    const res = await pool.query(`
      SELECT username, high_score, total_kills, gold, selected_skin
      FROM users
      ORDER BY high_score DESC
      LIMIT 10;
    `);
    return res.rows;
  } catch (err) {
    console.error('Database getGlobalLeaderboard error:', err.message);
    return [];
  }
}

module.exports = {
  pool,
  initDB,
  getOrCreateUser,
  saveUserMatch,
  updateUserInventory,
  getGlobalLeaderboard
};
