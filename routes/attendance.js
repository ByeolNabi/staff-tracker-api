// routes/attendance.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 출퇴근 기록하기
router.post('/record', async (req, res) => {
  const { person_name, record_type } = req.body;

  if (!person_name) {
    return res.status(400).json({ message: '직원 이름과 기록 유형은 필수입니다' });
  }
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // 트랜잭션 시작

    // 직원이 존재하는지 확인
    const [personRows] = await connection.query('SELECT * FROM person_info WHERE person_name = ?', [person_name]);

    if (personRows.length === 0) {
      await connection.rollback(); // 트랜잭션 롤백
      return res.status(404).json({ message: '해당 이름의 직원을 찾을 수 없습니다' });
    }

    const record_id = uuidv4();

    // attendance_records 테이블에 출퇴근 기록 추가
    await connection.query(
      'INSERT INTO attendance_records (record_id, person_name, is_present) VALUES (?, ?, ?)',
      [record_id, person_name, record_type]
    );

    // current_attendance 테이블 업데이트
    await connection.query(
      `INSERT INTO current_attendance (person_name, is_present, last_record_time)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
         is_present = VALUES(is_present),
         last_record_time = VALUES(last_record_time)`,
      [person_name, record_type]
    );

    await connection.commit(); // 트랜잭션 커밋
    res.status(201).json({ message: '출퇴근 기록이 성공적으로 저장되었습니다', record_id });

  } catch (error) {
    console.error('출퇴근 기록 오류:', error);
    if (connection) {
      await connection.rollback(); // 오류 발생 시 트랜잭션 롤백
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다' });

  } finally {
    if (connection) {
      connection.release(); // 커넥션 반환
    }
  }
});

// 특정 직원의 출퇴근 기록 조회
router.get('/:person_name', async (req, res) => {
  const { person_name } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM attendance_records WHERE person_name = ? ORDER BY record_time',
      [person_name]
    );

    res.json(rows);
  } catch (error) {
    console.error('출퇴근 기록 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 요일별 출퇴근 현황 조회
router.get('/weekly/:person_name', async (req, res) => {
  const { person_name } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT 
        record_time, 
        record_type, 
        DAYOFWEEK(STR_TO_DATE(record_time, '%Y-%m-%dT%H:%i:%s.%fZ')) as day_of_week
      FROM attendance_records 
      WHERE person_name = ? 
      ORDER BY record_time`,
      [person_name]
    );

    // 요일별로 데이터 그룹화
    const weeklyData = {
      1: [], // 일요일
      2: [], // 월요일
      3: [], // 화요일
      4: [], // 수요일
      5: [], // 목요일
      6: [], // 금요일
      7: []  // 토요일
    };

    rows.forEach(record => {
      if (record.day_of_week) {
        weeklyData[record.day_of_week].push({
          record_time: record.record_time,
          record_type: record.record_type
        });
      }
    });

    res.json(weeklyData);
  } catch (error) {
    console.error('요일별 출퇴근 현황 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 24시간 근무 현황 그래프 데이터 (특정 날짜 기준)
router.get('/timeline/:person_name', async (req, res) => {
  const { person_name } = req.params;
  const { date } = req.query; // YYYY-MM-DD 형식으로 받음

  if (!date) {
    return res.status(400).json({ message: '날짜 파라미터가 필요합니다 (YYYY-MM-DD 형식)' });
  }

  try {
    // 해당 날짜의 출퇴근 기록 조회
    const [rows] = await pool.query(
      `SELECT 
        record_time, 
        is_present AS record_type
      FROM attendance_records 
      WHERE 
        person_name = ? AND 
        DATE(record_time) = ?
      ORDER BY record_time`,
      [person_name, date]
    );

    if (rows.length === 0) { // 기록이 없는 경우 처리
      return res.status(404).json({ message: '해당 날짜에 출퇴근 기록이 없습니다' });
    }

    // 24시간 타임라인 생성 (각 시간별로 사무실 존재 여부 확인)
    const timeline = [];
    let isInOffice = false;
    let inTime = null;

    // 모든 기록을 순회하며 출근/퇴근 시간 쌍을 만듦
    for (let i = 0; i < rows.length; i++) {
      const record = rows[i];
      const recordTime = new Date(record.record_time);

      if (record.record_type === 1) { // is_present가 true (출근)
        isInOffice = true;
        inTime = recordTime;
      } else if (record.record_type === 0 && isInOffice) { // is_present가 false (퇴근)
        isInOffice = false;

        timeline.push({
          start: inTime.toISOString(),
          end: recordTime.toISOString(),
          duration: (recordTime - inTime) / (1000 * 60) // 분 단위로 계산
        });

        inTime = null;
      }
    }

    // 마지막 출근 기록이 있고 퇴근 기록이 없는 경우 현재 시간까지 계산
    if (isInOffice && inTime) {
      const now = new Date();
      timeline.push({
        start: inTime.toISOString(),
        end: now.toISOString(),
        duration: (now - inTime) / (1000 * 60) // 분 단위로 계산
      });
    }

    res.json({
      person_name,
      date,
      timeline
    });
  } catch (error) {
    console.error('근무 현황 타임라인 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;