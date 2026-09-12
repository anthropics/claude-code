import { useEffect } from 'react'
import { isEnvTruthy } from '../utils/envUtils.js'

export function useAfterFirstRender(): void {
  useEffect(() => {
    if (
      process.env.USER_TYPE === 'ant' &&
      isEnvTruthy(process.env.CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER)
    ) {
      process.stderr.write(
        `\nStartup time: ${Math.round(process.uptime() * 1000)}ms\n`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(0)
    }
  }, [])
}
