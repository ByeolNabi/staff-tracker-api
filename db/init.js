// db/init.js
// db/init.js
const { pool } = require('./connection');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    try {
      // 테이블이 없으면 테이블들을 생성
      console.log('Checking and creating tables if they do not exist...');
      
      // person_info 테이블 생성
      await connection.query(`
        CREATE TABLE IF NOT EXISTS person_info (
          person_name VARCHAR(255) NOT NULL,
          PRIMARY KEY (person_name)
        )
      `);
      console.log('person_info table checked/created');
      
      // admin 테이블 생성
      await connection.query(`
        CREATE TABLE IF NOT EXISTS admin (
          id VARCHAR(255) NOT NULL,
          pw VARCHAR(255) NULL,
          PRIMARY KEY (id)
        )
      `);
      console.log('admin table checked/created');
      
      // attendance_records 테이블 생성
      await connection.query(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          record_id VARCHAR(255) NOT NULL,
          person_name VARCHAR(255) NOT NULL,
          record_time VARCHAR(255) NULL,
          record_type VARCHAR(255) NULL,
          PRIMARY KEY (record_id, person_name),
          FOREIGN KEY (person_name) REFERENCES person_info (person_name)
        )
      `);
      console.log('attendance_records table checked/created');
      
      // admin 계정 생성 (초기 관리자 계정)
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT IGNORE INTO admin (id, pw) VALUES (?, ?)',
        ['admin', hashedPassword]
      );
      
      console.log('Database initialized successfully');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    console.error(error);
  }
}

module.exports = { initializeDatabase };