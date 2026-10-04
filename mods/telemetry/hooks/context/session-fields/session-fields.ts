/**
 * The row fields that are the session's for its whole life, before their
 * keys are spelled for the wire.
 *
 * The client, the entrypoint, the SDK and a benchmark run's ids, each
 * undefined when the environment names none.
 */
export type SessionFields = {
  readonly clientType: string
  readonly entrypoint: string | undefined
  readonly agentSdkVersion: string | undefined
  readonly sweBenchRunId: string | undefined
  readonly sweBenchInstanceId: string | undefined
  readonly sweBenchTaskId: string | undefined
}
