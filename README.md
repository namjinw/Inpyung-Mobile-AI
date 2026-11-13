<p align="center"><img src="app/assets/logo-circle.png" alt="로고" width="96" /></p>

# 모바일 앱 개발 도움 앱

모바일 앱 개발(기능경기대회) 준비용 **Claude Code 설치·실행기**예요. Windows 데스크톱 앱(Electron, Node.js + Vanilla JS)이고, 버튼 하나로 Claude Code를 설치하고, 팀 설정을 적용한 뒤 실행해요. 이미 설치된 Claude Code는 그대로 쓰고, 아무것도 지우지 않아요.

세 저장소가 함께 동작해요.

| 저장소 | 역할 |
|---|---|
| **이 저장소 (앱)** | Claude Code 설치, 팀 설정 적용, 로그인, 실행 |
| [Inpyung-Mobile-AI-Setting](https://github.com/namjinw/Inpyung-Mobile-AI-Setting) | 팀 공용 Claude Code 설정 (`CLAUDE.md`, `settings.json`, `/report` 명령어) |
| [WordSkilll_PLUSE](https://github.com/namjinw/WordSkilll_PLUSE) | `/report` 보고를 받는 서버 (GitHub 로그인, 달력) |

## 하는 일

[설치]를 누르면 4단계로 진행되고, 진행 상황이 `1/4 … 4/4`로 보여요.

1. **환경 점검**: Windows 버전, 디스크 여유 공간, 인터넷, API 키 환경 변수를 확인해요.
2. **클로드 설치**: 이미 설치된 `claude.exe`가 있으면 그대로 쓰고, 없으면 공식 배포 주소에서 받아 SHA256을 확인해요.
3. **Git 준비**: 설치된 Git이 있으면 그대로 쓰고, 없으면 휴대용 Git을 앱 폴더에 풀어요.
4. **클로드 환경 설정 가져오기**: 설정 저장소(`config.json`의 `settingsRepo`, `settingsTag`)에서 설정을 받아 적용할 파일 목록을 보여 주고, [적용]을 눌러야 설치가 끝나요. 제한과 `/report`가 빠진 채로 실행되지 않도록 건너뛰기는 없고, [설치 취소]를 누르면 설치가 중단돼요.

끝나면 버튼이 **[로그인]**으로 바뀌어요. 누르면 로그인 창과 브라우저가 열리고, 본인 Claude 계정으로 로그인하면 버튼이 **[실행]**으로 바뀌어요. 로그인은 이 앱이 아니라 claude가 앱 폴더(`data`)에 저장해서, **앱을 껐다 켜도 유지**되고 그 뒤에 여는 모든 Claude Code 창에서 자동으로 쓰여요. [실행]은 여러 번 눌러 **여러 개를 동시에** 열 수 있어요(버튼이 [새 Claude Code 창 열기]로 바뀌어요). 이전에 나눈 대화가 있으면 [실행]할 때 `--continue`로 **이어서 시작**해요(이미 열린 창이 있으면 새 대화예요). 처음 켤 때 테마는 **dark**, 기본 모델은 설정 저장소의 `settings.json`(`claude-sonnet-5-5`)을 따라요. 팀 설정이 바뀌었으면 **[설정 다시 받기]**를 눌러요. 사이드바 메뉴는 설치 / 안내 / 로그예요.

## 저장 위치 (지우지 않아요)

- 이 앱은 **설치만** 해요. 앱을 닫아도 아무것도 지우지 않아요.
- **이미 설치된 Claude Code가 있으면 그대로 써요**(PATH 또는 `~/.local/bin/claude.exe`). 없을 때만 `%LOCALAPPDATA%\ClaudeContest\data\bin`에 받아요.
- 팀 설정, 로그인, 대화 기록은 `%LOCALAPPDATA%\ClaudeContest\data\config`에 저장해요. 내 원래 `~/.claude`, `~/.claude.json`은 건드리지 않아서 서로 영향을 주지 않아요.
- 작업 폴더는 `Documents\ClaudeContest\work`, 내려받은 설치 파일 캐시는 `%LOCALAPPDATA%\ClaudeContest\cache`예요.
- 지우고 싶으면 앱을 닫고 `%LOCALAPPDATA%\ClaudeContest` 폴더를 직접 삭제하세요. (예전 버전이 남긴 `session` 폴더는 예전 버전이 알아서 지워요.)

## 알아둘 점

- 앱은 토큰이나 API 키를 저장하거나 입력하지 않아요.
- 설정 저장소가 비공개면 받을 때 GitHub 로그인 창이 한 번 떠요. 이 로그인 정보는 Git이 Windows 자격 증명 관리자에 저장해요. 공용 PC라면 사용 후 `github.com` 항목을 지워 주세요.
- 브라우저에 남은 claude.ai 로그인은 앱이 지울 수 없어요.
- 설정에 `/report` 명령어가 들어 있으면 적용 전에 알려 줘요. 이 명령어를 실행하면 작업 요약과 Git 커밋 기록, Claude에게 한 질문, 파일·폴더 변동 목록이 서버로 전송돼요. (실행하지 않으면 전송되지 않아요.)

## 실행

Node.js가 필요해요. 처음 한 번 의존성을 설치한 뒤 실행해요.

```bash
npm install
```

```bash
npm run app
```

## .env로 태그 지정

프로젝트 맨 위(배포한 exe는 exe 옆)의 `.env`에 아래 값을 두면 `config.json`을 고치지 않아도 돼요. `.env.example`을 복사해서 쓰고, `.env`는 git에 올라가지 않아요. 비밀 값은 넣지 않아요.

| 키 | 설명 |
|---|---|
| `SETTINGS_REPO` | 설정 저장소 (`소유자/저장소`) |
| `SETTINGS_TAG` | 받을 태그. `latest`면 저장소의 가장 높은 `vX.Y.Z` 태그를 자동으로 받아요. |

## exe 만들기

```bash
npm run pack
```

`release/` 폴더에 `WordSkillApp.exe`가 만들어져요. `.env`는 포함되지 않으니 exe 옆에 `.env`를 두세요. `release/`와 exe는 git에 올라가지 않아요.

## 설정 (`app/config.json`)

| 키 | 설명 |
|---|---|
| `settingsRepo` | 설정 저장소 (`소유자/저장소`) |
| `settingsTag` | 받을 태그 (예: `v0.1.0`). 보통은 아래 `.env`의 `SETTINGS_TAG`가 이 값을 덮어써요. |
| `settingsDir` | 저장소 안의 설정 폴더 (`.claude`) |
| `settingsFiles` | 적용을 허용하는 항목 (`CLAUDE.md`, `settings.json`, `skills`, `commands`, `agents`) |
| `gitTag`, `gitFile`, `gitSha256` | 휴대용 Git 버전과 해시 |
| `minFreeGB` | 필요한 최소 디스크 여유 공간 |
| `useCache` | 내려받은 설치 파일 캐시 사용 여부 |

## 폴더 구조

```
app/
├─ main.cjs        창, 설치 단계 진행, 종료 시 정리
├─ preload.cjs     화면이 쓸 수 있는 기능만 공개
├─ config.json     설정
├─ assets/         로고, 아이콘
├─ lib/            check, install, settings, session, paths, procs, net, env, log
└─ ui/             index.html, renderer.js, style.css
```

`app/assets/logo.png`는 로고 원본이고, `logo-circle.png`와 `icon.ico`는 이 원본으로 만든 원형 로고와 앱 아이콘이에요.

## 아직 확인하지 못한 것

처음 실제로 설치할 때 확인이 필요해요.

- 약 300MB 설치 파일을 받아 `claude.exe`가 단독으로 실행되는지
- 로그인 정보가 전용 설정 폴더 안에만 저장되는지 (원래 `~/.claude.json`에 항목이 생기지 않는지)
- 휴대용 Git 설치와 GitHub 로그인(자격 증명 관리자) 동작
- 새로 열린 Claude 창에서 키보드 입력이 되는지
