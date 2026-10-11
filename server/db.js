require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

function hashPassword(password) {
  const salt = 'meow_io_secret_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function initDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL successfully!');

    // Create or migrate users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255),
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

      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `);
    console.log('✅ Table "users" verified/migrated with Email & Password!');

    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
}

// Register a new user with username, email, password
async function registerUser(username, email, password) {
  const cleanName = String(username).trim().substring(0, 30);
  const cleanEmail = String(email).trim().toLowerCase();
  
  if (!cleanName || cleanName === 'undefined') {
    return { success: false, message: 'Tên người dùng không hợp lệ!' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Email không hợp lệ!' };
  }
  if (!password || password.length < 4) {
    return { success: false, message: 'Mật khẩu phải có ít nhất 4 ký tự!' };
  }

  try {
    // Check if username exists
    const checkName = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [cleanName]);
    if (checkName.rows.length > 0) {
      return { success: false, message: 'Tên người dùng này đã được sử dụng!' };
    }

    // Check if email exists
    const checkEmail = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (checkEmail.rows.length > 0) {
      return { success: false, message: 'Email này đã được đăng ký tài khoản!' };
    }

    const hashed = hashPassword(password);
    const res = await pool.query(`
      INSERT INTO users (username, email, password_hash, gold, dice, unlocked_skins, selected_skin, high_score)
      VALUES ($1, $2, $3, 150, 3, '["white", "orange"]'::jsonb, 'white', 100)
      RETURNING id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills;
    `, [cleanName, cleanEmail, hashed]);

    return { success: true, user: res.rows[0] };
  } catch (err) {
    console.error('registerUser error:', err.message);
    return { success: false, message: 'Lỗi server khi đăng ký: ' + err.message };
  }
}

// Login with username or email + password
async function loginUser(identifier, password) {
  const cleanId = String(identifier).trim();
  if (!cleanId || !password) {
    return { success: false, message: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' };
  }

  try {
    const hashed = hashPassword(password);
    const res = await pool.query(`
      SELECT id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills
      FROM users
      WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
        AND password_hash = $2
    `, [cleanId, hashed]);

    if (res.rows.length === 0) {
      return { success: false, message: 'Tên người dùng/Email hoặc mật khẩu không chính xác!' };
    }

    const user = res.rows[0];
    await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    return { success: true, user };
  } catch (err) {
    console.error('loginUser error:', err.message);
    return { success: false, message: 'Lỗi server khi đăng nhập: ' + err.message };
  }
}

// Guest user profile fallback
async function getOrCreateUser(username) {
  let cleanName = String(username).trim().substring(0, 30);
  if (!cleanName || cleanName === 'undefined' || cleanName === 'null') {
    cleanName = 'Mèo Hiệp Sĩ';
  }

  try {
    let res = await pool.query('SELECT id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills FROM users WHERE LOWER(username) = LOWER($1)', [cleanName]);
    if (res.rows.length === 0) {
      res = await pool.query(`
        INSERT INTO users (username, gold, dice, unlocked_skins, selected_skin, high_score)
        VALUES ($1, 150, 3, '["white", "orange"]'::jsonb, 'white', 100)
        RETURNING id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills;
      `, [cleanName]);
    } else {
      await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [res.rows[0].id]);
    }
    return res.rows[0];
  } catch (err) {
    console.error('Database getOrCreateUser error:', err.message);
    return null;
  }
}

async function saveUserMatch(username, { goldEarned = 0, diceEarned = 0, score = 100, kills = 0, unlockedSkins = null, selectedSkin = null }) {
  const cleanName = String(username).trim().substring(0, 30);
  if (!cleanName || cleanName === 'undefined') return null;

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
      WHERE LOWER(username) = LOWER($7)
      RETURNING id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills;
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
  if (!cleanName || cleanName === 'undefined') return null;

  try {
    const query = `
      UPDATE users
      SET
        gold = COALESCE($1, gold),
        dice = COALESCE($2, dice),
        unlocked_skins = COALESCE($3::jsonb, unlocked_skins),
        selected_skin = COALESCE($4, selected_skin),
        last_seen = CURRENT_TIMESTAMP
      WHERE LOWER(username) = LOWER($5)
      RETURNING id, username, email, gold, dice, unlocked_skins, selected_skin, high_score, total_kills;
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
      WHERE username IS NOT NULL AND username != 'undefined'
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
  registerUser,
  loginUser,
  getOrCreateUser,
  saveUserMatch,
  updateUserInventory,
  getGlobalLeaderboard
};
