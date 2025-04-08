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
          available BOOLEAN DEFAULT TRUE,
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
          record_id VARCHAR(255) NOT NULL DEFAULT (UUID()),
          person_name VARCHAR(255) NOT NULL,
          record_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NULL,
          is_present BOOLEAN DEFAULT FALSE,
          PRIMARY KEY (record_id, person_name),
          FOREIGN KEY (person_name) REFERENCES person_info (person_name)
        )
      `);
      console.log('attendance_records table checked/created');

      // current_attendance 테이블 생성 (is_present 컬럼 추가 및 기본값 설정)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS current_attendance (
          person_name VARCHAR(255) NOT NULL,
          is_present BOOLEAN DEFAULT FALSE,
          last_record_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (person_name),
          FOREIGN KEY (person_name) REFERENCES person_info (person_name)
        )
      `);
      console.log('current_attendance table checked/created');

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