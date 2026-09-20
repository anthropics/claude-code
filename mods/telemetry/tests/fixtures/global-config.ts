import { DEVICE_ID } from './device-id.js'

/**
 * The CLI's global config as the session's machine holds it: the install's
 * device id and the signed-in account, among keys the plugin never reads.
 */
export const GLOBAL_CONFIG = JSON.stringify({
  autoUpdates: true,
  userID: DEVICE_ID,
  oauthAccount: {
    accountUuid: 'acc-1111-2222',
    organizationUuid: 'org-3333-4444',
    emailAddress: 'person@example.invalid',
  },
  projects: { '/work': {} },
})
