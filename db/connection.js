// db/connection.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'db',
  user: 'root', // 데이터베이스 사용자명
  password: 'root', // 데이터베이스 비밀번호
  database: 'staff_tracker', // 데이터베이스 이름
  waitForConnections: true,
  port : 3306,
  connectionLimit: 100,
  queueLimit: 0
});

module.exports = { pool };

// docker run --name mysql-container -e MYSQL_ROOT_PASSWORD=root -d -p 3307:3306 mysql:latest
// mysql -u root -p
// CREATE DATABASE staff_tracker;

// docker build -t node-api:latest .
// docker run --name node-container -d -p 3306:3000 node-api:latest