/**
 * Who the rows are from, as the CLI's global config records it: the
 * install's device id, and the signed-in account's ids and address.
 *
 * Each is undefined when the config has none or cannot be read; the address
 * rides only on an internal build's rows, as the CLI's own does.
 */
export type Identity = {
  readonly deviceId: string | undefined
  readonly accountUuid: string | undefined
  readonly organizationUuid: string | undefined
  readonly email: string | undefined
}
