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
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip; // 또는 req.headers['x-forwarded-for'] (프록시 환경)
  const userAgent = req.headers['user-agent'];

  console.log(`[${timestamp}] ${method} ${url} from ${ip} (${userAgent})`);

  // 요청 본문(body)이 있다면 로그에 추가 (POST, PUT 등)
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('  Body:', JSON.stringify(req.body));
  }

  next(); // 다음 미들웨어 또는 라우트 핸들러로 진행
};

// 모든 요청에 requestLogger 미들웨어 적용

app.use(cors({
  origin: ['http://localhost:4173', 'http://113.198.230.24:1012'], // 프론트엔드 도메인
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // 쿠키를 포함한 요청 허용
}));
app.use(express.json()); // JSON 요청 본문 파싱을 위해 필요
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);

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
