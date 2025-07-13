# Recording API 사용 가이드

## 개요

Recording API는 AFFiNE에서 미팅 녹화 상태를 관리하기 위한 REST API입니다. 각 녹화 디바이스가 독립적으로 자신의 상태를 보고하고, 서버가 이를 취합하여 전체 녹화 상태를 관리합니다.

## 테스트 스크립트 사용법

### 기본 사용법

```bash
node test-recording-api.js <workspace-id> <command> [arguments]
```

### 주요 명령어

#### 1. 녹화 시작 (start)

미팅 녹화를 시작할 때 사용합니다.

```bash
node test-recording-api.js <workspace-id> start <meetingId> [description]

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d start 13A "회의실 13A 녹화"
```

#### 2. 처리 상태로 전환 (processing)

녹화가 완료되고 처리 중일 때 사용합니다.

```bash
node test-recording-api.js <workspace-id> processing <meetingId> [description]

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d processing 13A
```

#### 3. 녹화 중지 (stop)

미팅 녹화를 종료할 때 사용합니다.

```bash
node test-recording-api.js <workspace-id> stop <meetingId>

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d stop 13A
```

#### 4. 디바이스 상태 업데이트 (update)

개별 디바이스의 상태를 업데이트할 때 사용합니다.

```bash
node test-recording-api.js <workspace-id> update <device> [meetingId] [status]

# 예시 - 녹화 중인 디바이스
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d update Device_13A 13A recording

# 예시 - 대기 중인 디바이스
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d update Device_13B null waiting
```

상태 값:

- `recording`: 녹화 중
- `processing`: 처리 중
- `waiting`: 대기 중

#### 5. 헬스 체크 (health)

디바이스가 활성 상태임을 서버에 알릴 때 사용합니다.

```bash
node test-recording-api.js <workspace-id> health <meetingId> <status>

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d health 13A recording
```

#### 6. 현재 상태 조회 (status)

현재 녹화 상태와 이벤트 목록을 조회합니다.

```bash
node test-recording-api.js <workspace-id> status

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d status
```

#### 7. 초기화 (reset)

모든 녹화 상태를 초기화합니다.

```bash
node test-recording-api.js <workspace-id> reset

# 예시
node test-recording-api.js 49086e68-e27d-409a-9940-abb4d5d3802d reset
```

#### 8. 데모 실행 (demo)

전체 녹화 플로우를 시연합니다.

```bash
node test-recording-api.js <workspace-id> demo
```

#### 9. 헬스 체크 데모 (health-demo)

헬스 체크 타임아웃 동작을 시연합니다.

```bash
node test-recording-api.js <workspace-id> health-demo
```

## 운영 가이드

### 1. 녹화 시작 프로세스

1. **디바이스 대기 상태 등록** (선택사항)

   ```bash
   node test-recording-api.js <workspace-id> update Device_13A null waiting
   ```

2. **녹화 시작**

   ```bash
   node test-recording-api.js <workspace-id> start 13A "회의실 13A 정기 회의"
   ```

3. **디바이스 상태 업데이트**

   ```bash
   node test-recording-api.js <workspace-id> update Device_13A 13A recording
   ```

4. **정기적인 헬스 체크** (5분마다)
   ```bash
   node test-recording-api.js <workspace-id> health 13A recording
   ```

### 2. 헬스 체크 관리

#### 중요성

- 디바이스는 **5분마다** 헬스 체크를 보내야 합니다
- **10분 이상** 헬스 체크가 없으면 자동으로 녹화가 종료됩니다
- 네트워크 장애나 디바이스 오류로 인한 좀비 세션을 방지합니다

#### 구현 예시 (실제 디바이스에서)

```javascript
// 5분마다 헬스 체크 전송
setInterval(
  () => {
    sendHealthCheck(workspaceId, meetingId, 'recording');
  },
  5 * 60 * 1000
);
```

### 3. 다중 디바이스 관리

여러 디바이스가 동시에 녹화할 때:

```bash
# 디바이스 1 - 회의실 13A
node test-recording-api.js <workspace-id> start 13A
node test-recording-api.js <workspace-id> update Device_13A 13A recording

# 디바이스 2 - 회의실 13B
node test-recording-api.js <workspace-id> start 13B
node test-recording-api.js <workspace-id> update Device_13B 13B recording

# 각 디바이스별 헬스 체크
node test-recording-api.js <workspace-id> health 13A recording
node test-recording-api.js <workspace-id> health 13B recording
```

### 4. 상태 전환 시나리오

#### 녹화 → 처리 중

```bash
# 녹화 완료 후 처리 시작
node test-recording-api.js <workspace-id> processing 13A
node test-recording-api.js <workspace-id> update Device_13A 13A processing
node test-recording-api.js <workspace-id> health 13A processing
```

#### 처리 완료 → 종료

```bash
# 처리 완료 후 녹화 종료
node test-recording-api.js <workspace-id> stop 13A
```

### 5. 오류 처리

#### 디바이스 비정상 종료

- 헬스 체크가 10분 이상 없으면 자동으로 `recording_stop` 이벤트 발생
- `reason: 'health_check_timeout'`으로 표시됨

#### 수동 복구

```bash
# 상태 확인
node test-recording-api.js <workspace-id> status

# 필요시 초기화
node test-recording-api.js <workspace-id> reset

# 다시 시작
node test-recording-api.js <workspace-id> start 13A
```

## API 엔드포인트 상세

### POST /api/recording/:workspaceId/start

미팅 녹화를 시작합니다.

- Body: `{ meetingId, device?, description? }`
- 이미 존재하는 미팅은 업데이트됨

### POST /api/recording/:workspaceId/processing

미팅을 처리 상태로 전환합니다.

- Body: `{ meetingId, device?, description? }`

### POST /api/recording/:workspaceId/stop

미팅 녹화를 종료합니다.

- Body: `{ meetingId }`

### POST /api/recording/:workspaceId/update

디바이스 상태를 업데이트합니다.

- Body: `{ device, status, meetingId? }`
- 개별 디바이스가 자신의 상태만 보고

### POST /api/recording/:workspaceId/health

헬스 체크를 전송합니다.

- Body: `{ meetingId, device, status }`
- 10분 타임아웃 갱신

### GET /api/recording/:workspaceId/events

이벤트 목록과 현재 상태를 조회합니다.

- Query: `?since=<index>` (선택사항)
- Response: 이벤트 목록과 활성 미팅 정보

### POST /api/recording/:workspaceId/reset

모든 녹화 상태를 초기화합니다.

## 모범 사례

1. **항상 헬스 체크 구현**

   - 실제 디바이스는 반드시 5분마다 헬스 체크 전송
   - 네트워크 재연결 시 즉시 헬스 체크 전송

2. **상태 동기화**

   - 디바이스 시작 시 현재 상태 조회 (`status`)
   - 예상치 못한 종료 후 재시작 시 상태 확인

3. **오류 처리**

   - API 호출 실패 시 재시도 로직 구현
   - 헬스 체크 실패 시 로깅 및 알림

4. **로깅**
   - 모든 상태 변경 로깅
   - 헬스 체크 전송/실패 로깅

## 트러블슈팅

### 미팅이 표시되지 않음

1. `status` 명령으로 현재 상태 확인
2. `activeMeetings` 배열 확인
3. 헬스 체크 타임아웃 여부 확인

### 헬스 체크가 작동하지 않음

1. 서버 로그에서 헬스 체크 수신 확인
2. 디바이스와 미팅 ID가 올바른지 확인
3. 네트워크 연결 상태 확인

### 자동 종료되지 않음

1. 서버가 최신 버전인지 확인
2. `HEALTH_CHECK_TIMEOUT_MS` 설정 확인 (기본 10분)
3. 서버 재시작 필요할 수 있음
