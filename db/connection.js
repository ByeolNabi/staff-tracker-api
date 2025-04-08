// db/connection.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // 데이터베이스 사용자명
  password: 'root', // 데이터베이스 비밀번호
  database: 'staff_tracker', // 데이터베이스 이름
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

module.exports = { pool };
