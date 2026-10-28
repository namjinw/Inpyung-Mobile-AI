// 실행할 claude에게 줄 환경변수. 이 프로세스 안에서만 쓰고 시스템 환경변수는 건드리지 않는다.
const { dirs } = require('./paths.cjs')

const BILLING_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']

function buildEnv(bashPath) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    // 다른 claude 세션이 남긴 값, 우회 연결(Bedrock 등) 설정은 모두 지운다.
    if (k === 'CLAUDECODE' || k === 'CLAUDE_CONFIG_DIR' || k.startsWith('CLAUDE_CODE_')) delete env[k]
  }
  for (const k of BILLING_VARS) delete env[k] // API 과금 방지: 값은 그대로 두고 이 실행에서만 뺀다.
  env.CLAUDE_CONFIG_DIR = dirs.config // 설정과 로그인 정보를 전용 폴더에 저장
  env.DISABLE_AUTOUPDATER = '1' // 자동 업데이트가 폴더 밖에 파일을 만들지 않게 함
  if (bashPath) env.CLAUDE_CODE_GIT_BASH_PATH = bashPath
  return env
}

module.exports = { buildEnv, BILLING_VARS }
