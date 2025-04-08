// routes/person.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// 모든 직원 정보 조회
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM current_attendance');
    res.json(rows);
  } catch (error) {
    console.error('직원 정보 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 직원 추가 (admin 비밀번호 재확인)
router.post('/', authenticateToken, async (req, res) => {
  const { person_name, admin_pw } = req.body;

  if (!person_name || !admin_pw) {
    return res.status(400).json({ message: '직원 이름과 비밀번호는 필수입니다' });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // JWT에서 사용자 ID 추출
    const userId = req.user.id;

    // 데이터베이스에서 사용자 정보 조회
    const [rows] = await connection.execute('SELECT pw FROM admin WHERE id = ?', [userId]);
    const user = rows[0];

    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 비밀번호 비교
    const isMatch = await bcrypt.compare(admin_pw, user.pw);
    if (!isMatch) {
      await connection.rollback();
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다' });
    }

    await pool.query('INSERT INTO person_info (person_name) VALUES (?)', [person_name]);

    // current_attendance 테이블에 초기 잔류 상태 추가 (false로 가정)
    await connection.execute('INSERT INTO current_attendance (person_name, is_present) VALUES (?, ?)', [person_name, false]);

    await connection.commit(); // 모든 쿼리 성공 시 커밋
    res.status(201).json({ message: '직원이 성공적으로 추가되었습니다' });

  } catch (error) {
    console.error('직원 추가 오류:', error);
    if (connection) {
      await connection.rollback(); // 오류 발생 시 롤백
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '이미 존재하는 직원 이름입니다' });
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  } finally {
    if (connection) {
      connection.release(); // 커넥션 반환 (성공, 실패 여부와 관계없이)
    }
  }
});

// 직원 삭제
router.delete('/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 먼저 current_attendance 테이블에서 해당 직원 삭제
    await connection.query('DELETE FROM current_attendance WHERE person_name = ?', [name]);

    // attendance_records 테이블에서 해당 직원의 출퇴근 기록 삭제
    await connection.query('DELETE FROM attendance_records WHERE person_name = ?', [name]);

    // person_info 테이블에서 직원 삭제
    const [result] = await connection.query('DELETE FROM person_info WHERE person_name = ?', [name]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '해당 이름의 직원을 찾을 수 없습니다' });
    }

    await connection.commit(); // 모든 삭제 작업 성공 시 커밋
    res.json({ message: '직원이 성공적으로 삭제되었습니다' });
  } catch (error) {
    console.error('직원 삭제 오류:', error);
    if (connection) {
      await connection.rollback(); // 오류 발생 시 롤백
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  } finally {
    if (connection) {
      connection.release(); // 커넥션 반환
    }
  }
});

module.exports = router;