// app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// 라우터들
const authRoutes = require('./routes/auth');
const personRoutes = require('./routes/person');
const attendanceRoutes = require('./routes/attendance');

// 데이터베이스 연결
const { pool } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret'; // 실제 환경에서는 환경변수 사용 권장

// 미들웨어
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 라우트 설정
app.use('/api/auth', authRoutes);
app.use('/api/person', personRoutes);
app.use('/api/attendance', attendanceRoutes);

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  require('./db/init').initializeDatabase();
});

module.exports = app;
