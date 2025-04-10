// routes/attendance.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 출퇴근 상세 기록표
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

// 요일별 출퇴근 o/x 조회
router.get('/weekly', async (req, res) => {
  console.log('/weekly');
  try {
    // 이번 주의 월요일과 일요일 날짜 계산 (KST 기준)
    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // UTC+9 (한국 표준시)
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // 월요일
    const lastDayOfWeek = new Date(today.setDate(firstDayOfWeek.getDate() + 6)); // 일요일

    // 날짜를 YYYY-MM-DD 형식으로 변환
    const formatDate = (date) => new Date(date.getTime() + kstOffset).toISOString().split('T')[0];
    const startOfWeek = formatDate(firstDayOfWeek);
    const endOfWeek = formatDate(lastDayOfWeek);

    // 이번 주의 모든 직원 출퇴근 기록 조회
    const [rows] = await pool.query(
      `SELECT 
        person_name,
        DATE(CONVERT_TZ(record_time, '+00:00', '+09:00')) AS record_date,
        is_present
      FROM attendance_records
      WHERE DATE(CONVERT_TZ(record_time, '+00:00', '+09:00')) BETWEEN ? AND ?
      ORDER BY person_name, record_time`,
      [startOfWeek, endOfWeek]
    );

    // 모든 직원의 요일별 출근 여부 초기화
    const weeklyStatus = {};

    // 요일 매핑
    const dayMapping = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      0: 'Sunday', // JavaScript에서 일요일은 0
    };

    // 직원별로 데이터를 그룹화
    rows.forEach((record) => {
      const recordDate = new Date(record.record_date);
      const dayOfWeek = dayMapping[recordDate.getDay()]; // 요일 이름 가져오기

      if (!weeklyStatus[record.person_name]) {
        // 직원 이름으로 초기화
        weeklyStatus[record.person_name] = {
          Monday: false,
          Tuesday: false,
          Wednesday: false,
          Thursday: false,
          Friday: false,
          Saturday: false,
          Sunday: false,
        };
      }

      if (record.is_present) {
        weeklyStatus[record.person_name][dayOfWeek] = true; // 출근 기록이 있으면 true로 설정
      }
    });

    res.json(weeklyStatus);
  } catch (error) {
    console.error('주간 출퇴근 현황 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// 특정 직원의 출퇴근 기록 조회
router.get('/:person_name', async (req, res) => {
  const { person_name } = req.params;

  try {
    // 이번 주의 월요일과 일요일 날짜 계산 (KST 기준)
    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // UTC+9 (한국 표준시)
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // 월요일
    const lastDayOfWeek = new Date(today.setDate(firstDayOfWeek.getDate() + 6)); // 일요일

    // 날짜를 YYYY-MM-DD 형식으로 변환
    const formatDate = (date) => new Date(date.getTime() + kstOffset).toISOString().split('T')[0];
    const startOfWeek = formatDate(firstDayOfWeek);
    const endOfWeek = formatDate(lastDayOfWeek);

    // 해당 직원의 이번 주 출퇴근 기록 조회
    const [rows] = await pool.query(
      `SELECT 
        CONVERT_TZ(record_time, '+00:00', '+09:00') AS record_time, 
        is_present 
      FROM attendance_records 
      WHERE 
        person_name = ? AND 
        DATE(CONVERT_TZ(record_time, '+00:00', '+09:00')) BETWEEN ? AND ?
      ORDER BY record_time`,
      [person_name, startOfWeek, endOfWeek]
    );

    // 요일별 시간 초기화
    const weeklyTimeline = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    // 요일 매핑
    const dayMapping = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      0: 'Sunday', // JavaScript에서 일요일은 0
    };

    // 출퇴근 기록을 순회하며 요일별 시간 계산 (KST 기준)
    let isInOffice = false;
    let inTime = null;

    rows.forEach((record) => {
      const recordTime = new Date(record.record_time); // 이미 KST로 변환된 시간
      const dayOfWeek = dayMapping[recordTime.getDay()];

      if (record.is_present) {
        // 출근 기록
        isInOffice = true;
        inTime = recordTime;
      } else if (!record.is_present && isInOffice) {
        // 퇴근 기록
        isInOffice = false;
        const outTime = recordTime;

        // 해당 요일에 머문 시간 추가
        weeklyTimeline[dayOfWeek].push({
          start: inTime.toISOString(),
          end: outTime.toISOString(),
          duration: (outTime - inTime) / (1000 * 60), // 분 단위로 계산
        });

        inTime = null;
      }
    });

    // 마지막 출근 기록이 있고 퇴근 기록이 없는 경우 현재 시간까지 계산
    if (isInOffice && inTime) {
      const now = new Date(); // 현재 시간 (KST 기준)
      const dayOfWeek = dayMapping[now.getDay()];
      weeklyTimeline[dayOfWeek].push({
        start: inTime.toISOString(),
        end: now.toISOString(),
        duration: (now - inTime) / (1000 * 60), // 분 단위로 계산
      });
    }

    res.json({
      person_name,
      weeklyTimeline,
    });
  } catch (error) {
    console.error('주간 타임라인 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;