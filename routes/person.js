// routes/person.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 모든 직원 정보 조회
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM person_info');
    res.json(rows);
  } catch (error) {
    console.error('직원 정보 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 직원 추가
router.post('/', authenticateToken, async (req, res) => {
  const { person_name } = req.body;
  
  if (!person_name) {
    return res.status(400).json({ message: '직원 이름은 필수입니다' });
  }
  
  try {
    await pool.query('INSERT INTO person_info (person_name) VALUES (?)', [person_name]);
    res.status(201).json({ message: '직원이 성공적으로 추가되었습니다' });
  } catch (error) {
    console.error('직원 추가 오류:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '이미 존재하는 직원 이름입니다' });
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 직원 삭제
router.delete('/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;
  
  try {
    // 먼저 해당 직원의 출퇴근 기록 삭제
    await pool.query('DELETE FROM attendance_records WHERE person_name = ?', [name]);
    
    // 그 다음 직원 정보 삭제
    const [result] = await pool.query('DELETE FROM person_info WHERE person_name = ?', [name]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '해당 이름의 직원을 찾을 수 없습니다' });
    }
    
    res.json({ message: '직원이 성공적으로 삭제되었습니다' });
  } catch (error) {
    console.error('직원 삭제 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;