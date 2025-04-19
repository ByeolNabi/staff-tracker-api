# 가져올 이미지를 정의
FROM node:slim
# 경로 설정하기
WORKDIR /app
# package.json 워킹 디렉토리에 복사 (.은 설정한 워킹 디렉토리를 뜻함)
COPY package.json .
# 명령어 실행 (의존성 설치)
RUN npm install
# 현재 디렉토리의 모든 파일을 도커 컨테이너의 워킹 디렉토리에 복사한다.
COPY . .

# npm start 스크립트 실행
CMD ["npm", "start"]

# 그리고 Dockerfile로 docker 이미지를 빌드해야한다.
# docker run --name mysql-container -e MYSQL_ROOT_PASSWORD=root -d -p 3307:3306 mysql:latest

# docker build -t node-api:latest .
# docker run --name node-container -d -p 3306:3000 node-api:latest