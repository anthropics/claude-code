import type { ConfigLocation } from '../../config-location'
import Entries from '../../entries'
import { globalConfigPath } from './global-config-path'
import type { Identity } from './identity'
import { plausibleUuid } from './plausible-uuid'

/**
 * Reads the identity the CLI's global config records: the device id it
 * minted for this install, and the account it is signed in to.
 *
 * A config that is missing, unreadable or not JSON yields an identity with
 * nothing in it; the address is kept on an internal build alone.
 *
 * @param read reads a file as text
 * @param location where the config is
 * @param isInternal whether this is an internal build
 * @returns the identity, each field undefined unless the config has it
 */
export async function identityOf(
  read: (path: string) => Promise<string>,
  location: ConfigLocation,
  isInternal: boolean,
): Promise<Identity> {
  const path = globalConfigPath(location)

  let config: unknown

  try {
    config = path === undefined ? undefined : JSON.parse(await read(path))
  } catch {
    config = undefined
  }

  const record = Entries.isRecord(config) ? config : {}

  const account = Entries.isRecord(record.oauthAccount)
    ? record.oauthAccount
    : {}

  const deviceId = record.userID
  const email = account.emailAddress

  const isDeviceId =
    typeof deviceId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(deviceId)

  const isEmailKept = isInternal && typeof email === 'string' && email !== ''

  return {
    deviceId: isDeviceId ? deviceId : undefined,
    accountUuid: plausibleUuid(account.accountUuid),
    organizationUuid: plausibleUuid(account.organizationUuid),
    email: isEmailKept ? email : undefined,
  }
}
