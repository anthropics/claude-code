import type { Context } from '../../context'

/**
 * What one batch stamps on each of its rows beside the row's own fields:
 * the session as read when the batch went out, and its context.
 *
 * `userType` is `ant` or `external` as USER_TYPE says of the build;
 * `isClaudeAiAuth` follows the credential the batch is sent with.
 */
export type BatchStamp = {
  readonly sessionId: string
  readonly model: string
  readonly userType: string
  readonly isInteractive: boolean
  readonly isClaudeAiAuth: boolean
  readonly context: Context
}
