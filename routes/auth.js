// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../db/connection');

const JWT_SECRET = 'your_jwt_secret'; // 실제 환경에서는 환경변수 사용 권장

// 로그인 API
router.post('/login', async (req, res) => {
  const { id, pw } = req.body;
  
  if (!id || !pw) {
    return res.status(400).json({ message: '아이디와 비밀번호를 입력해 주세요' });
  }
  
  try {
    const [rows] = await pool.query('SELECT * FROM admin WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: '존재하지 않는 관리자 계정입니다' });
    }
    
    const admin = rows[0];
    const isPasswordValid = await bcrypt.compare(pw, admin.pw);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다' });
    }
    
    // JWT 토큰 생성
    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      message: '로그인 성공',
      token
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;