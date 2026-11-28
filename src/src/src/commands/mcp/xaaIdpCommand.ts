/**
 * `claude mcp xaa` — manage the XAA (SEP-990) IdP connection.
 *
 * The IdP connection is user-level: configure once, all XAA-enabled MCP
 * servers reuse it. Lives in settings.xaaIdp (non-secret) + a keychain slot
 * keyed by issuer (secret). Separate trust domain from per-server AS secrets.
 */
import type { Command } from '@commander-js/extra-typings'
import { cliError, cliOk } from '../../cli/exit.js'
import {
  acquireIdpIdToken,
  clearIdpClientSecret,
  clearIdpIdToken,
  getCachedIdpIdToken,
  getIdpClientSecret,
  getXaaIdpSettings,
  issuerKey,
  saveIdpClientSecret,
  saveIdpIdTokenFromJwt,
} from '../../services/mcp/xaaIdpLogin.js'
import { errorMessage } from '../../utils/errors.js'
import { updateSettingsForSource } from '../../utils/settings/settings.js'

export function registerMcpXaaIdpCommand(mcp: Command): void {
  const xaaIdp = mcp
    .command('xaa')
    .description('Manage the XAA (SEP-990) IdP connection')

  xaaIdp
    .command('setup')
    .description(
      'Configure the IdP connection (one-time setup for all XAA-enabled servers)',
    )
    .requiredOption('--issuer <url>', 'IdP issuer URL (OIDC discovery)')
    .requiredOption('--client-id <id>', "Claude Code's client_id at the IdP")
    .option(
      '--client-secret',
      'Read IdP client secret from MCP_XAA_IDP_CLIENT_SECRET env var',
    )
    .option(
      '--callback-port <port>',
      'Fixed loopback callback port (only if IdP does not honor RFC 8252 port-any matching)',
    )
    .action(options => {
      // Validate everything BEFORE any writes. An exit(1) mid-write leaves
      // settings configured but keychain missing — confusing state.
      // updateSettingsForSource doesn't schema-check on write; a non-URL
      // issuer lands on disk and then poisons the whole userSettings source
      // on next launch (SettingsSchema .url() fails → parseSettingsFile
      // returns { settings: null }, dropping everything, not just xaaIdp).
      let issuerUrl: URL
      try {
        issuerUrl = new URL(options.issuer)
      } catch {
        return cliError(
          `Error: --issuer must be a valid URL (got "${options.issuer}")`,
        )
      }
      // OIDC discovery + token exchange run against this host. Allow http://
      // only for loopback (conformance harness mock IdP); anything else leaks
      // the client secret and authorization code over plaintext.
      if (
        issuerUrl.protocol !== 'https:' &&
        !(
          issuerUrl.protocol === 'http:' &&
          (issuerUrl.hostname === 'localhost' ||
            issuerUrl.hostname === '127.0.0.1' ||
            issuerUrl.hostname === '[::1]')
        )
      ) {
        return cliError(
          `Error: --issuer must use https:// (got "${issuerUrl.protocol}//${issuerUrl.host}")`,
        )
      }
      const callbackPort = options.callbackPort
        ? parseInt(options.callbackPort, 10)
        : undefined
      // callbackPort <= 0 fails Zod's .positive() on next launch — same
      // settings-poisoning failure mode as the issuer check above.
      if (
        callbackPort !== undefined &&
        (!Number.isInteger(callbackPort) || callbackPort <= 0)
      ) {
        return cliError('Error: --callback-port must be a positive integer')
      }
      const secret = options.clientSecret
        ? process.env.MCP_XAA_IDP_CLIENT_SECRET
        : undefined
      if (options.clientSecret && !secret) {
        return cliError(
          'Error: --client-secret requires MCP_XAA_IDP_CLIENT_SECRET env var',
        )
      }

      // Read old config now (before settings overwrite) so we can clear stale
      // keychain slots after a successful write. `clear` can't do this after
      // the fact — it reads the *current* settings.xaaIdp, which by then is
      // the new one.
      const old = getXaaIdpSettings()
      const oldIssuer = old?.issuer
      const oldClientId = old?.clientId

      // callbackPort MUST be present (even as undefined) — mergeWith deep-merges
      // and only deletes on explicit `undefined`, not on absent key. A conditional
      // spread would leak a prior fixed port into a new IdP's config.
      const { error } = updateSettingsForSource('userSettings', {
        xaaIdp: {
          issuer: options.issuer,
          clientId: options.clientId,
          callbackPort,
        },
      })
      if (error) {
        return cliError(`Error writing settings: ${error.message}`)
      }

      // Clear stale keychain slots only after settings write succeeded —
      // otherwise a write failure leaves settings pointing at oldIssuer with
      // its secret already gone. Compare via issuerKey(): trailing-slash or
      // host-case differences normalize to the same keychain slot.
      if (oldIssuer) {
        if (issuerKey(oldIssuer) !== issuerKey(options.issuer)) {
          clearIdpIdToken(oldIssuer)
          clearIdpClientSecret(oldIssuer)
        } else if (oldClientId !== options.clientId) {
          // Same issuer slot but different OAuth client registration — the
          // cached id_token's aud claim and the stored secret are both for the
          // old client. `xaa login` would send {new clientId, old secret} and
          // fail with opaque `invalid_client`; downstream SEP-990 exchange
          // would fail aud validation. Keep both when clientId is unchanged:
          // re-setup without --client-secret means "tweak port, keep secret".
          clearIdpIdToken(oldIssuer)
          clearIdpClientSecret(oldIssuer)
        }
      }

      if (secret) {
        const { success, warning } = saveIdpClientSecret(options.issuer, secret)
        if (!success) {
          return cliError(
            `Error: settings written but keychain save failed${warning ? ` — ${warning}` : ''}. ` +
              `Re-run with --client-secret once keychain is available.`,
          )
        }
      }

      cliOk(`XAA IdP connection configured for ${options.issuer}`)
    })

  xaaIdp
    .command('login')
    .description(
      'Cache an IdP id_token so XAA-enabled MCP servers authenticate ' +
        'silently. Default: run the OIDC browser login. With --id-token: ' +
        'write a pre-obtained JWT directly (used by conformance/e2e tests ' +
        'where the mock IdP does not serve /authorize).',
    )
    .option(
      '--force',
      'Ignore any cached id_token and re-login (useful after IdP-side revocation)',
    )
    // TODO(paulc): read the JWT from stdin instead of argv to keep it out of
    // shell history. Fine for conformance (docker exec uses argv directly,
    // no shell parser), but a real user would want `echo $TOKEN | ... --stdin`.
    .option(
      '--id-token <jwt>',
      'Write this pre-obtained id_token directly to cache, skipping the OIDC browser login',
    )
    .action(async options => {
      const idp = getXaaIdpSettings()
      if (!idp) {
        return cliError(
          "Error: no XAA IdP connection. Run 'claude mcp xaa setup' first.",
        )
      }

      // Direct-inject path: skip cache check, skip OIDC. Writing IS the
      // operation. Issuer comes from settings (single source of truth), not
      // a separate flag — one less thing to desync.
      if (options.idToken) {
        const expiresAt = saveIdpIdTokenFromJwt(idp.issuer, options.idToken)
        return cliOk(
          `id_token cached for ${idp.issuer} (expires ${new Date(expiresAt).toISOString()})`,
        )
      }

      if (options.force) {
        clearIdpIdToken(idp.issuer)
      }

      const wasCached = getCachedIdpIdToken(idp.issuer) !== undefined
      if (wasCached) {
        return cliOk(
          `Already logged in to ${idp.issuer} (cached id_token still valid). Use --force to re-login.`,
        )
      }

      process.stdout.write(`Opening browser for IdP login at ${idp.issuer}…\n`)
      try {
        await acquireIdpIdToken({
          idpIssuer: idp.issuer,
          idpClientId: idp.clientId,
          idpClientSecret: getIdpClientSecret(idp.issuer),
          callbackPort: idp.callbackPort,
          onAuthorizationUrl: url => {
            process.stdout.write(
              `If the browser did not open, visit:\n  ${url}\n`,
            )
          },
        })
        cliOk(
          `Logged in. MCP servers with --xaa will now authenticate silently.`,
        )
      } catch (e) {
        cliError(`IdP login failed: ${errorMessage(e)}`)
      }
    })

  xaaIdp
    .command('show')
    .description('Show the current IdP connection config')
    .action(() => {
      const idp = getXaaIdpSettings()
      if (!idp) {
        return cliOk('No XAA IdP connection configured.')
      }
      const hasSecret = getIdpClientSecret(idp.issuer) !== undefined
      const hasIdToken = getCachedIdpIdToken(idp.issuer) !== undefined
      process.stdout.write(`Issuer:        ${idp.issuer}\n`)
      process.stdout.write(`Client ID:     ${idp.clientId}\n`)
      if (idp.callbackPort !== undefined) {
        process.stdout.write(`Callback port: ${idp.callbackPort}\n`)
      }
      process.stdout.write(
        `Client secret: ${hasSecret ? '(stored in keychain)' : '(not set — PKCE-only)'}\n`,
      )
      process.stdout.write(
        `Logged in:     ${hasIdToken ? 'yes (id_token cached)' : "no — run 'claude mcp xaa login'"}\n`,
      )
      cliOk()
    })

  xaaIdp
    .command('clear')
    .description('Clear the IdP connection config and cached id_token')
    .action(() => {
      // Read issuer first so we can clear the right keychain slots.
      const idp = getXaaIdpSettings()
      // updateSettingsForSource uses mergeWith: set to undefined (not delete)
      // to signal key removal.
      const { error } = updateSettingsForSource('userSettings', {
        xaaIdp: undefined,
      })
      if (error) {
        return cliError(`Error writing settings: ${error.message}`)
      }
      // Clear keychain only after settings write succeeded — otherwise a
      // write failure leaves settings pointing at the IdP with its secrets
      // already gone (same pattern as `setup`'s old-issuer cleanup).
      if (idp) {
        clearIdpIdToken(idp.issuer)
        clearIdpClientSecret(idp.issuer)
      }
      cliOk('XAA IdP connection cleared')
    })
}
