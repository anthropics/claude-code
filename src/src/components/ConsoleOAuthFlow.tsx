import { c as _c } from "react/compiler-runtime";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { installOAuthTokens } from '../cli/handlers/auth.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { setClipboard } from '../ink/termio/osc.js';
import { useTerminalNotification } from '../ink/useTerminalNotification.js';
import { Box, Link, Text } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { getSSLErrorHint } from '../services/api/errorUtils.js';
import { sendNotification } from '../services/notifier.js';
import { OAuthService } from '../services/oauth/index.js';
import { getOauthAccountInfo, validateForceLoginOrg } from '../utils/auth.js';
import { logError } from '../utils/log.js';
import { getSettings_DEPRECATED } from '../utils/settings/settings.js';
import { Select } from './CustomSelect/select.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Spinner } from './Spinner.js';
import TextInput from './TextInput.js';
type Props = {
  onDone(): void;
  startingMessage?: string;
  mode?: 'login' | 'setup-token';
  forceLoginMethod?: 'claudeai' | 'console';
};
type OAuthStatus = {
  state: 'idle';
} // Initial state, waiting to select login method
| {
  state: 'platform_setup';
} // Show platform setup info (Bedrock/Vertex/Foundry)
| {
  state: 'ready_to_start';
} // Flow started, waiting for browser to open
| {
  state: 'waiting_for_login';
  url: string;
} // Browser opened, waiting for user to login
| {
  state: 'creating_api_key';
} // Got access token, creating API key
| {
  state: 'about_to_retry';
  nextState: OAuthStatus;
} | {
  state: 'success';
  token?: string;
} | {
  state: 'error';
  message: string;
  toRetry?: OAuthStatus;
};
const PASTE_HERE_MSG = 'Paste code here if prompted > ';
export function ConsoleOAuthFlow({
  onDone,
  startingMessage,
  mode = 'login',
  forceLoginMethod: forceLoginMethodProp
}: Props): React.ReactNode {
  const settings = getSettings_DEPRECATED() || {};
  const forceLoginMethod = forceLoginMethodProp ?? settings.forceLoginMethod;
  const orgUUID = settings.forceLoginOrgUUID;
  const forcedMethodMessage = forceLoginMethod === 'claudeai' ? 'Login method pre-selected: Subscription Plan (Claude Pro/Max)' : forceLoginMethod === 'console' ? 'Login method pre-selected: API Usage Billing (Anthropic Console)' : null;
  const terminal = useTerminalNotification();
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>(() => {
    if (mode === 'setup-token') {
      return {
        state: 'ready_to_start'
      };
    }
    if (forceLoginMethod === 'claudeai' || forceLoginMethod === 'console') {
      return {
        state: 'ready_to_start'
      };
    }
    return {
      state: 'idle'
    };
  });
  const [pastedCode, setPastedCode] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [oauthService] = useState(() => new OAuthService());
  const [loginWithClaudeAi, setLoginWithClaudeAi] = useState(() => {
    // Use Claude AI auth for setup-token mode to support user:inference scope
    return mode === 'setup-token' || forceLoginMethod === 'claudeai';
  });
  // After a few seconds we suggest the user to copy/paste url if the
  // browser did not open automatically. In this flow we expect the user to
  // copy the code from the browser and paste it in the terminal
  const [showPastePrompt, setShowPastePrompt] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const textInputColumns = useTerminalSize().columns - PASTE_HERE_MSG.length - 1;

  // Log forced login method on mount
  useEffect(() => {
    if (forceLoginMethod === 'claudeai') {
      logEvent('tengu_oauth_claudeai_forced', {});
    } else if (forceLoginMethod === 'console') {
      logEvent('tengu_oauth_console_forced', {});
    }
  }, [forceLoginMethod]);

  // Retry logic
  useEffect(() => {
    if (oauthStatus.state === 'about_to_retry') {
      const timer = setTimeout(setOAuthStatus, 1000, oauthStatus.nextState);
      return () => clearTimeout(timer);
    }
  }, [oauthStatus]);

  // Handle Enter to continue on success state
  useKeybinding('confirm:yes', () => {
    logEvent('tengu_oauth_success', {
      loginWithClaudeAi
    });
    onDone();
  }, {
    context: 'Confirmation',
    isActive: oauthStatus.state === 'success' && mode !== 'setup-token'
  });

  // Handle Enter to continue from platform setup
  useKeybinding('confirm:yes', () => {
    setOAuthStatus({
      state: 'idle'
    });
  }, {
    context: 'Confirmation',
    isActive: oauthStatus.state === 'platform_setup'
  });

  // Handle Enter to retry on error state
  useKeybinding('confirm:yes', () => {
    if (oauthStatus.state === 'error' && oauthStatus.toRetry) {
      setPastedCode('');
      setOAuthStatus({
        state: 'about_to_retry',
        nextState: oauthStatus.toRetry
      });
    }
  }, {
    context: 'Confirmation',
    isActive: oauthStatus.state === 'error' && !!oauthStatus.toRetry
  });
  useEffect(() => {
    if (pastedCode === 'c' && oauthStatus.state === 'waiting_for_login' && showPastePrompt && !urlCopied) {
      void setClipboard(oauthStatus.url).then(raw => {
        if (raw) process.stdout.write(raw);
        setUrlCopied(true);
        setTimeout(setUrlCopied, 2000, false);
      });
      setPastedCode('');
    }
  }, [pastedCode, oauthStatus, showPastePrompt, urlCopied]);
  async function handleSubmitCode(value: string, url: string) {
    try {
      // Expecting format "authorizationCode#state" from the authorization callback URL
      const [authorizationCode, state] = value.split('#');
      if (!authorizationCode || !state) {
        setOAuthStatus({
          state: 'error',
          message: 'Invalid code. Please make sure the full code was copied',
          toRetry: {
            state: 'waiting_for_login',
            url
          }
        });
        return;
      }

      // Track which path the user is taking (manual code entry)
      logEvent('tengu_oauth_manual_entry', {});
      oauthService.handleManualAuthCodeInput({
        authorizationCode,
        state
      });
    } catch (err: unknown) {
      logError(err);
      setOAuthStatus({
        state: 'error',
        message: (err as Error).message,
        toRetry: {
          state: 'waiting_for_login',
          url
        }
      });
    }
  }
  const startOAuth = useCallback(async () => {
    try {
      logEvent('tengu_oauth_flow_start', {
        loginWithClaudeAi
      });
      const result = await oauthService.startOAuthFlow(async url_0 => {
        setOAuthStatus({
          state: 'waiting_for_login',
          url: url_0
        });
        setTimeout(setShowPastePrompt, 3000, true);
      }, {
        loginWithClaudeAi,
        inferenceOnly: mode === 'setup-token',
        expiresIn: mode === 'setup-token' ? 365 * 24 * 60 * 60 : undefined,
        // 1 year for setup-token
        orgUUID
      }).catch(err_1 => {
        const isTokenExchangeError = err_1.message.includes('Token exchange failed');
        // Enterprise TLS proxies (Zscaler et al.) intercept the token
        // exchange POST and cause cryptic SSL errors. Surface an
        // actionable hint so the user isn't stuck in a login loop.
        const sslHint_0 = getSSLErrorHint(err_1);
        setOAuthStatus({
          state: 'error',
          message: sslHint_0 ?? (isTokenExchangeError ? 'Failed to exchange authorization code for access token. Please try again.' : err_1.message),
          toRetry: mode === 'setup-token' ? {
            state: 'ready_to_start'
          } : {
            state: 'idle'
          }
        });
        logEvent('tengu_oauth_token_exchange_error', {
          error: err_1.message,
          ssl_error: sslHint_0 !== null
        });
        throw err_1;
      });
      if (mode === 'setup-token') {
        // For setup-token mode, return the OAuth access token directly (it can be used as an API key)
        // Don't save to keychain - the token is displayed for manual use with CLAUDE_CODE_OAUTH_TOKEN
        setOAuthStatus({
          state: 'success',
          token: result.accessToken
        });
      } else {
        await installOAuthTokens(result);
        const orgResult = await validateForceLoginOrg();
        if (!orgResult.valid) {
          throw new Error(orgResult.message);
        }
        setOAuthStatus({
          state: 'success'
        });
        void sendNotification({
          message: 'Claude Code login successful',
          notificationType: 'auth_success'
        }, terminal);
      }
    } catch (err_0) {
      const errorMessage = (err_0 as Error).message;
      const sslHint = getSSLErrorHint(err_0);
      setOAuthStatus({
        state: 'error',
        message: sslHint ?? errorMessage,
        toRetry: {
          state: mode === 'setup-token' ? 'ready_to_start' : 'idle'
        }
      });
      logEvent('tengu_oauth_error', {
        error: errorMessage as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ssl_error: sslHint !== null
      });
    }
  }, [oauthService, setShowPastePrompt, loginWithClaudeAi, mode, orgUUID]);
  const pendingOAuthStartRef = useRef(false);
  useEffect(() => {
    if (oauthStatus.state === 'ready_to_start' && !pendingOAuthStartRef.current) {
      pendingOAuthStartRef.current = true;
      process.nextTick((startOAuth_0: () => Promise<void>, pendingOAuthStartRef_0: React.MutableRefObject<boolean>) => {
        void startOAuth_0();
        pendingOAuthStartRef_0.current = false;
      }, startOAuth, pendingOAuthStartRef);
    }
  }, [oauthStatus.state, startOAuth]);

  // Auto-exit for setup-token mode
  useEffect(() => {
    if (mode === 'setup-token' && oauthStatus.state === 'success') {
      // Delay to ensure static content is fully rendered before exiting
      const timer_0 = setTimeout((loginWithClaudeAi_0, onDone_0) => {
        logEvent('tengu_oauth_success', {
          loginWithClaudeAi: loginWithClaudeAi_0
        });
        // Don't clear terminal so the token remains visible
        onDone_0();
      }, 500, loginWithClaudeAi, onDone);
      return () => clearTimeout(timer_0);
    }
  }, [mode, oauthStatus, loginWithClaudeAi, onDone]);

  // Cleanup OAuth service when component unmounts
  useEffect(() => {
    return () => {
      oauthService.cleanup();
    };
  }, [oauthService]);
  return <Box flexDirection="column" gap={1}>
      {oauthStatus.state === 'waiting_for_login' && showPastePrompt && <Box flexDirection="column" key="urlToCopy" gap={1} paddingBottom={1}>
          <Box paddingX={1}>
            <Text dimColor>
              Browser didn&apos;t open? Use the url below to sign in{' '}
            </Text>
            {urlCopied ? <Text color="success">(Copied!)</Text> : <Text dimColor>
                <KeyboardShortcutHint shortcut="c" action="copy" parens />
              </Text>}
          </Box>
          <Link url={oauthStatus.url}>
            <Text dimColor>{oauthStatus.url}</Text>
          </Link>
        </Box>}
      {mode === 'setup-token' && oauthStatus.state === 'success' && oauthStatus.token && <Box key="tokenOutput" flexDirection="column" gap={1} paddingTop={1}>
            <Text color="success">
              ✓ Long-lived authentication token created successfully!
            </Text>
            <Box flexDirection="column" gap={1}>
              <Text>Your OAuth token (valid for 1 year):</Text>
              <Text color="warning">{oauthStatus.token}</Text>
              <Text dimColor>
                Store this token securely. You won&apos;t be able to see it
                again.
              </Text>
              <Text dimColor>
                Use this token by setting: export
                CLAUDE_CODE_OAUTH_TOKEN=&lt;token&gt;
              </Text>
            </Box>
          </Box>}
      <Box paddingLeft={1} flexDirection="column" gap={1}>
        <OAuthStatusMessage oauthStatus={oauthStatus} mode={mode} startingMessage={startingMessage} forcedMethodMessage={forcedMethodMessage} showPastePrompt={showPastePrompt} pastedCode={pastedCode} setPastedCode={setPastedCode} cursorOffset={cursorOffset} setCursorOffset={setCursorOffset} textInputColumns={textInputColumns} handleSubmitCode={handleSubmitCode} setOAuthStatus={setOAuthStatus} setLoginWithClaudeAi={setLoginWithClaudeAi} />
      </Box>
    </Box>;
}
type OAuthStatusMessageProps = {
  oauthStatus: OAuthStatus;
  mode: 'login' | 'setup-token';
  startingMessage: string | undefined;
  forcedMethodMessage: string | null;
  showPastePrompt: boolean;
  pastedCode: string;
  setPastedCode: (value: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  textInputColumns: number;
  handleSubmitCode: (value: string, url: string) => void;
  setOAuthStatus: (status: OAuthStatus) => void;
  setLoginWithClaudeAi: (value: boolean) => void;
};
function OAuthStatusMessage(t0) {
  const $ = _c(51);
  const {
    oauthStatus,
    mode,
    startingMessage,
    forcedMethodMessage,
    showPastePrompt,
    pastedCode,
    setPastedCode,
    cursorOffset,
    setCursorOffset,
    textInputColumns,
    handleSubmitCode,
    setOAuthStatus,
    setLoginWithClaudeAi
  } = t0;
  switch (oauthStatus.state) {
    case "idle":
      {
        const t1 = startingMessage ? startingMessage : "Claude Code can be used with your Claude subscription or billed based on API usage through your Console account.";
        let t2;
        if ($[0] !== t1) {
          t2 = <Text bold={true}>{t1}</Text>;
          $[0] = t1;
          $[1] = t2;
        } else {
          t2 = $[1];
        }
        let t3;
        if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
          t3 = <Text>Select login method:</Text>;
          $[2] = t3;
        } else {
          t3 = $[2];
        }
        let t4;
        if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
          t4 = {
            label: <Text>Claude account with subscription ·{" "}<Text dimColor={true}>Pro, Max, Team, or Enterprise</Text>{false && <Text>{"\n"}<Text color="warning">[ANT-ONLY]</Text>{" "}<Text dimColor={true}>Please use this option unless you need to login to a special org for accessing sensitive data (e.g. customer data, HIPI data) with the Console option</Text></Text>}{"\n"}</Text>,
            value: "claudeai"
          };
          $[3] = t4;
        } else {
          t4 = $[3];
        }
        let t5;
        if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
          t5 = {
            label: <Text>Anthropic Console account ·{" "}<Text dimColor={true}>API usage billing</Text>{"\n"}</Text>,
            value: "console"
          };
          $[4] = t5;
        } else {
          t5 = $[4];
        }
        let t6;
        if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
          t6 = [t4, t5, {
            label: <Text>3rd-party platform ·{" "}<Text dimColor={true}>Amazon Bedrock, Microsoft Foundry, or Vertex AI</Text>{"\n"}</Text>,
            value: "platform"
          }];
          $[5] = t6;
        } else {
          t6 = $[5];
        }
        let t7;
        if ($[6] !== setLoginWithClaudeAi || $[7] !== setOAuthStatus) {
          t7 = <Box><Select options={t6} onChange={value_0 => {
              if (value_0 === "platform") {
                logEvent("tengu_oauth_platform_selected", {});
                setOAuthStatus({
                  state: "platform_setup"
                });
              } else {
                setOAuthStatus({
                  state: "ready_to_start"
                });
                if (value_0 === "claudeai") {
                  logEvent("tengu_oauth_claudeai_selected", {});
                  setLoginWithClaudeAi(true);
                } else {
                  logEvent("tengu_oauth_console_selected", {});
                  setLoginWithClaudeAi(false);
                }
              }
            }} /></Box>;
          $[6] = setLoginWithClaudeAi;
          $[7] = setOAuthStatus;
          $[8] = t7;
        } else {
          t7 = $[8];
        }
        let t8;
        if ($[9] !== t2 || $[10] !== t7) {
          t8 = <Box flexDirection="column" gap={1} marginTop={1}>{t2}{t3}{t7}</Box>;
          $[9] = t2;
          $[10] = t7;
          $[11] = t8;
        } else {
          t8 = $[11];
        }
        return t8;
      }
    case "platform_setup":
      {
        let t1;
        if ($[12] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Text bold={true}>Using 3rd-party platforms</Text>;
          $[12] = t1;
        } else {
          t1 = $[12];
        }
        let t2;
        let t3;
        if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
          t2 = <Text>Claude Code supports Amazon Bedrock, Microsoft Foundry, and Vertex AI. Set the required environment variables, then restart Claude Code.</Text>;
          t3 = <Text>If you are part of an enterprise organization, contact your administrator for setup instructions.</Text>;
          $[13] = t2;
          $[14] = t3;
        } else {
          t2 = $[13];
          t3 = $[14];
        }
        let t4;
        if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
          t4 = <Text bold={true}>Documentation:</Text>;
          $[15] = t4;
        } else {
          t4 = $[15];
        }
        let t5;
        if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
          t5 = <Text>· Amazon Bedrock:{" "}<Link url="https://code.claude.com/docs/en/amazon-bedrock">https://code.claude.com/docs/en/amazon-bedrock</Link></Text>;
          $[16] = t5;
        } else {
          t5 = $[16];
        }
        let t6;
        if ($[17] === Symbol.for("react.memo_cache_sentinel")) {
          t6 = <Text>· Microsoft Foundry:{" "}<Link url="https://code.claude.com/docs/en/microsoft-foundry">https://code.claude.com/docs/en/microsoft-foundry</Link></Text>;
          $[17] = t6;
        } else {
          t6 = $[17];
        }
        let t7;
        if ($[18] === Symbol.for("react.memo_cache_sentinel")) {
          t7 = <Box flexDirection="column" marginTop={1}>{t4}{t5}{t6}<Text>· Vertex AI:{" "}<Link url="https://code.claude.com/docs/en/google-vertex-ai">https://code.claude.com/docs/en/google-vertex-ai</Link></Text></Box>;
          $[18] = t7;
        } else {
          t7 = $[18];
        }
        let t8;
        if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
          t8 = <Box flexDirection="column" gap={1} marginTop={1}>{t1}<Box flexDirection="column" gap={1}>{t2}{t3}{t7}<Box marginTop={1}><Text dimColor={true}>Press <Text bold={true}>Enter</Text> to go back to login options.</Text></Box></Box></Box>;
          $[19] = t8;
        } else {
          t8 = $[19];
        }
        return t8;
      }
    case "waiting_for_login":
      {
        let t1;
        if ($[20] !== forcedMethodMessage) {
          t1 = forcedMethodMessage && <Box><Text dimColor={true}>{forcedMethodMessage}</Text></Box>;
          $[20] = forcedMethodMessage;
          $[21] = t1;
        } else {
          t1 = $[21];
        }
        let t2;
        if ($[22] !== showPastePrompt) {
          t2 = !showPastePrompt && <Box><Spinner /><Text>Opening browser to sign in…</Text></Box>;
          $[22] = showPastePrompt;
          $[23] = t2;
        } else {
          t2 = $[23];
        }
        let t3;
        if ($[24] !== cursorOffset || $[25] !== handleSubmitCode || $[26] !== oauthStatus.url || $[27] !== pastedCode || $[28] !== setCursorOffset || $[29] !== setPastedCode || $[30] !== showPastePrompt || $[31] !== textInputColumns) {
          t3 = showPastePrompt && <Box><Text>{PASTE_HERE_MSG}</Text><TextInput value={pastedCode} onChange={setPastedCode} onSubmit={value => handleSubmitCode(value, oauthStatus.url)} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} columns={textInputColumns} mask="*" /></Box>;
          $[24] = cursorOffset;
          $[25] = handleSubmitCode;
          $[26] = oauthStatus.url;
          $[27] = pastedCode;
          $[28] = setCursorOffset;
          $[29] = setPastedCode;
          $[30] = showPastePrompt;
          $[31] = textInputColumns;
          $[32] = t3;
        } else {
          t3 = $[32];
        }
        let t4;
        if ($[33] !== t1 || $[34] !== t2 || $[35] !== t3) {
          t4 = <Box flexDirection="column" gap={1}>{t1}{t2}{t3}</Box>;
          $[33] = t1;
          $[34] = t2;
          $[35] = t3;
          $[36] = t4;
        } else {
          t4 = $[36];
        }
        return t4;
      }
    case "creating_api_key":
      {
        let t1;
        if ($[37] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Box flexDirection="column" gap={1}><Box><Spinner /><Text>Creating API key for Claude Code…</Text></Box></Box>;
          $[37] = t1;
        } else {
          t1 = $[37];
        }
        return t1;
      }
    case "about_to_retry":
      {
        let t1;
        if ($[38] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Box flexDirection="column" gap={1}><Text color="permission">Retrying…</Text></Box>;
          $[38] = t1;
        } else {
          t1 = $[38];
        }
        return t1;
      }
    case "success":
      {
        let t1;
        if ($[39] !== mode || $[40] !== oauthStatus.token) {
          t1 = mode === "setup-token" && oauthStatus.token ? null : <>{getOauthAccountInfo()?.emailAddress ? <Text dimColor={true}>Logged in as{" "}<Text>{getOauthAccountInfo()?.emailAddress}</Text></Text> : null}<Text color="success">Login successful. Press <Text bold={true}>Enter</Text> to continue…</Text></>;
          $[39] = mode;
          $[40] = oauthStatus.token;
          $[41] = t1;
        } else {
          t1 = $[41];
        }
        let t2;
        if ($[42] !== t1) {
          t2 = <Box flexDirection="column">{t1}</Box>;
          $[42] = t1;
          $[43] = t2;
        } else {
          t2 = $[43];
        }
        return t2;
      }
    case "error":
      {
        let t1;
        if ($[44] !== oauthStatus.message) {
          t1 = <Text color="error">OAuth error: {oauthStatus.message}</Text>;
          $[44] = oauthStatus.message;
          $[45] = t1;
        } else {
          t1 = $[45];
        }
        let t2;
        if ($[46] !== oauthStatus.toRetry) {
          t2 = oauthStatus.toRetry && <Box marginTop={1}><Text color="permission">Press <Text bold={true}>Enter</Text> to retry.</Text></Box>;
          $[46] = oauthStatus.toRetry;
          $[47] = t2;
        } else {
          t2 = $[47];
        }
        let t3;
        if ($[48] !== t1 || $[49] !== t2) {
          t3 = <Box flexDirection="column" gap={1}>{t1}{t2}</Box>;
          $[48] = t1;
          $[49] = t2;
          $[50] = t3;
        } else {
          t3 = $[50];
        }
        return t3;
      }
    default:
      {
        return null;
      }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlRWZmZWN0IiwidXNlUmVmIiwidXNlU3RhdGUiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJpbnN0YWxsT0F1dGhUb2tlbnMiLCJ1c2VUZXJtaW5hbFNpemUiLCJzZXRDbGlwYm9hcmQiLCJ1c2VUZXJtaW5hbE5vdGlmaWNhdGlvbiIsIkJveCIsIkxpbmsiLCJUZXh0IiwidXNlS2V5YmluZGluZyIsImdldFNTTEVycm9ySGludCIsInNlbmROb3RpZmljYXRpb24iLCJPQXV0aFNlcnZpY2UiLCJnZXRPYXV0aEFjY291bnRJbmZvIiwidmFsaWRhdGVGb3JjZUxvZ2luT3JnIiwibG9nRXJyb3IiLCJnZXRTZXR0aW5nc19ERVBSRUNBVEVEIiwiU2VsZWN0IiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJTcGlubmVyIiwiVGV4dElucHV0IiwiUHJvcHMiLCJvbkRvbmUiLCJzdGFydGluZ01lc3NhZ2UiLCJtb2RlIiwiZm9yY2VMb2dpbk1ldGhvZCIsIk9BdXRoU3RhdHVzIiwic3RhdGUiLCJ1cmwiLCJuZXh0U3RhdGUiLCJ0b2tlbiIsIm1lc3NhZ2UiLCJ0b1JldHJ5IiwiUEFTVEVfSEVSRV9NU0ciLCJDb25zb2xlT0F1dGhGbG93IiwiZm9yY2VMb2dpbk1ldGhvZFByb3AiLCJSZWFjdE5vZGUiLCJzZXR0aW5ncyIsIm9yZ1VVSUQiLCJmb3JjZUxvZ2luT3JnVVVJRCIsImZvcmNlZE1ldGhvZE1lc3NhZ2UiLCJ0ZXJtaW5hbCIsIm9hdXRoU3RhdHVzIiwic2V0T0F1dGhTdGF0dXMiLCJwYXN0ZWRDb2RlIiwic2V0UGFzdGVkQ29kZSIsImN1cnNvck9mZnNldCIsInNldEN1cnNvck9mZnNldCIsIm9hdXRoU2VydmljZSIsImxvZ2luV2l0aENsYXVkZUFpIiwic2V0TG9naW5XaXRoQ2xhdWRlQWkiLCJzaG93UGFzdGVQcm9tcHQiLCJzZXRTaG93UGFzdGVQcm9tcHQiLCJ1cmxDb3BpZWQiLCJzZXRVcmxDb3BpZWQiLCJ0ZXh0SW5wdXRDb2x1bW5zIiwiY29sdW1ucyIsImxlbmd0aCIsInRpbWVyIiwic2V0VGltZW91dCIsImNsZWFyVGltZW91dCIsImNvbnRleHQiLCJpc0FjdGl2ZSIsInRoZW4iLCJyYXciLCJwcm9jZXNzIiwic3Rkb3V0Iiwid3JpdGUiLCJoYW5kbGVTdWJtaXRDb2RlIiwidmFsdWUiLCJhdXRob3JpemF0aW9uQ29kZSIsInNwbGl0IiwiaGFuZGxlTWFudWFsQXV0aENvZGVJbnB1dCIsImVyciIsIkVycm9yIiwic3RhcnRPQXV0aCIsInJlc3VsdCIsInN0YXJ0T0F1dGhGbG93IiwiaW5mZXJlbmNlT25seSIsImV4cGlyZXNJbiIsInVuZGVmaW5lZCIsImNhdGNoIiwiaXNUb2tlbkV4Y2hhbmdlRXJyb3IiLCJpbmNsdWRlcyIsInNzbEhpbnQiLCJlcnJvciIsInNzbF9lcnJvciIsImFjY2Vzc1Rva2VuIiwib3JnUmVzdWx0IiwidmFsaWQiLCJub3RpZmljYXRpb25UeXBlIiwiZXJyb3JNZXNzYWdlIiwicGVuZGluZ09BdXRoU3RhcnRSZWYiLCJjdXJyZW50IiwibmV4dFRpY2siLCJQcm9taXNlIiwiTXV0YWJsZVJlZk9iamVjdCIsImNsZWFudXAiLCJPQXV0aFN0YXR1c01lc3NhZ2VQcm9wcyIsIm9mZnNldCIsInN0YXR1cyIsIk9BdXRoU3RhdHVzTWVzc2FnZSIsInQwIiwiJCIsIl9jIiwidDEiLCJ0MiIsInQzIiwiU3ltYm9sIiwiZm9yIiwidDQiLCJsYWJlbCIsInQ1IiwidDYiLCJ0NyIsInZhbHVlXzAiLCJ0OCIsImVtYWlsQWRkcmVzcyJdLCJzb3VyY2VzIjpbIkNvbnNvbGVPQXV0aEZsb3cudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQge1xuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIGxvZ0V2ZW50LFxufSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgaW5zdGFsbE9BdXRoVG9rZW5zIH0gZnJvbSAnLi4vY2xpL2hhbmRsZXJzL2F1dGguanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICcuLi9ob29rcy91c2VUZXJtaW5hbFNpemUuanMnXG5pbXBvcnQgeyBzZXRDbGlwYm9hcmQgfSBmcm9tICcuLi9pbmsvdGVybWlvL29zYy5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsTm90aWZpY2F0aW9uIH0gZnJvbSAnLi4vaW5rL3VzZVRlcm1pbmFsTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgQm94LCBMaW5rLCBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyBnZXRTU0xFcnJvckhpbnQgfSBmcm9tICcuLi9zZXJ2aWNlcy9hcGkvZXJyb3JVdGlscy5qcydcbmltcG9ydCB7IHNlbmROb3RpZmljYXRpb24gfSBmcm9tICcuLi9zZXJ2aWNlcy9ub3RpZmllci5qcydcbmltcG9ydCB7IE9BdXRoU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL29hdXRoL2luZGV4LmpzJ1xuaW1wb3J0IHsgZ2V0T2F1dGhBY2NvdW50SW5mbywgdmFsaWRhdGVGb3JjZUxvZ2luT3JnIH0gZnJvbSAnLi4vdXRpbHMvYXV0aC5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCB9IGZyb20gJy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgU2VsZWN0IH0gZnJvbSAnLi9DdXN0b21TZWxlY3Qvc2VsZWN0LmpzJ1xuaW1wb3J0IHsgS2V5Ym9hcmRTaG9ydGN1dEhpbnQgfSBmcm9tICcuL2Rlc2lnbi1zeXN0ZW0vS2V5Ym9hcmRTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi9TcGlubmVyLmpzJ1xuaW1wb3J0IFRleHRJbnB1dCBmcm9tICcuL1RleHRJbnB1dC5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgb25Eb25lKCk6IHZvaWRcbiAgc3RhcnRpbmdNZXNzYWdlPzogc3RyaW5nXG4gIG1vZGU/OiAnbG9naW4nIHwgJ3NldHVwLXRva2VuJ1xuICBmb3JjZUxvZ2luTWV0aG9kPzogJ2NsYXVkZWFpJyB8ICdjb25zb2xlJ1xufVxuXG50eXBlIE9BdXRoU3RhdHVzID1cbiAgfCB7IHN0YXRlOiAnaWRsZScgfSAvLyBJbml0aWFsIHN0YXRlLCB3YWl0aW5nIHRvIHNlbGVjdCBsb2dpbiBtZXRob2RcbiAgfCB7IHN0YXRlOiAncGxhdGZvcm1fc2V0dXAnIH0gLy8gU2hvdyBwbGF0Zm9ybSBzZXR1cCBpbmZvIChCZWRyb2NrL1ZlcnRleC9Gb3VuZHJ5KVxuICB8IHsgc3RhdGU6ICdyZWFkeV90b19zdGFydCcgfSAvLyBGbG93IHN0YXJ0ZWQsIHdhaXRpbmcgZm9yIGJyb3dzZXIgdG8gb3BlblxuICB8IHsgc3RhdGU6ICd3YWl0aW5nX2Zvcl9sb2dpbic7IHVybDogc3RyaW5nIH0gLy8gQnJvd3NlciBvcGVuZWQsIHdhaXRpbmcgZm9yIHVzZXIgdG8gbG9naW5cbiAgfCB7IHN0YXRlOiAnY3JlYXRpbmdfYXBpX2tleScgfSAvLyBHb3QgYWNjZXNzIHRva2VuLCBjcmVhdGluZyBBUEkga2V5XG4gIHwgeyBzdGF0ZTogJ2Fib3V0X3RvX3JldHJ5JzsgbmV4dFN0YXRlOiBPQXV0aFN0YXR1cyB9XG4gIHwgeyBzdGF0ZTogJ3N1Y2Nlc3MnOyB0b2tlbj86IHN0cmluZyB9XG4gIHwge1xuICAgICAgc3RhdGU6ICdlcnJvcidcbiAgICAgIG1lc3NhZ2U6IHN0cmluZ1xuICAgICAgdG9SZXRyeT86IE9BdXRoU3RhdHVzXG4gICAgfVxuXG5jb25zdCBQQVNURV9IRVJFX01TRyA9ICdQYXN0ZSBjb2RlIGhlcmUgaWYgcHJvbXB0ZWQgPiAnXG5cbmV4cG9ydCBmdW5jdGlvbiBDb25zb2xlT0F1dGhGbG93KHtcbiAgb25Eb25lLFxuICBzdGFydGluZ01lc3NhZ2UsXG4gIG1vZGUgPSAnbG9naW4nLFxuICBmb3JjZUxvZ2luTWV0aG9kOiBmb3JjZUxvZ2luTWV0aG9kUHJvcCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3Qgc2V0dGluZ3MgPSBnZXRTZXR0aW5nc19ERVBSRUNBVEVEKCkgfHwge31cbiAgY29uc3QgZm9yY2VMb2dpbk1ldGhvZCA9IGZvcmNlTG9naW5NZXRob2RQcm9wID8/IHNldHRpbmdzLmZvcmNlTG9naW5NZXRob2RcbiAgY29uc3Qgb3JnVVVJRCA9IHNldHRpbmdzLmZvcmNlTG9naW5PcmdVVUlEXG4gIGNvbnN0IGZvcmNlZE1ldGhvZE1lc3NhZ2UgPVxuICAgIGZvcmNlTG9naW5NZXRob2QgPT09ICdjbGF1ZGVhaSdcbiAgICAgID8gJ0xvZ2luIG1ldGhvZCBwcmUtc2VsZWN0ZWQ6IFN1YnNjcmlwdGlvbiBQbGFuIChDbGF1ZGUgUHJvL01heCknXG4gICAgICA6IGZvcmNlTG9naW5NZXRob2QgPT09ICdjb25zb2xlJ1xuICAgICAgICA/ICdMb2dpbiBtZXRob2QgcHJlLXNlbGVjdGVkOiBBUEkgVXNhZ2UgQmlsbGluZyAoQW50aHJvcGljIENvbnNvbGUpJ1xuICAgICAgICA6IG51bGxcblxuICBjb25zdCB0ZXJtaW5hbCA9IHVzZVRlcm1pbmFsTm90aWZpY2F0aW9uKClcblxuICBjb25zdCBbb2F1dGhTdGF0dXMsIHNldE9BdXRoU3RhdHVzXSA9IHVzZVN0YXRlPE9BdXRoU3RhdHVzPigoKSA9PiB7XG4gICAgaWYgKG1vZGUgPT09ICdzZXR1cC10b2tlbicpIHtcbiAgICAgIHJldHVybiB7IHN0YXRlOiAncmVhZHlfdG9fc3RhcnQnIH1cbiAgICB9XG4gICAgaWYgKGZvcmNlTG9naW5NZXRob2QgPT09ICdjbGF1ZGVhaScgfHwgZm9yY2VMb2dpbk1ldGhvZCA9PT0gJ2NvbnNvbGUnKSB7XG4gICAgICByZXR1cm4geyBzdGF0ZTogJ3JlYWR5X3RvX3N0YXJ0JyB9XG4gICAgfVxuICAgIHJldHVybiB7IHN0YXRlOiAnaWRsZScgfVxuICB9KVxuXG4gIGNvbnN0IFtwYXN0ZWRDb2RlLCBzZXRQYXN0ZWRDb2RlXSA9IHVzZVN0YXRlKCcnKVxuICBjb25zdCBbY3Vyc29yT2Zmc2V0LCBzZXRDdXJzb3JPZmZzZXRdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW29hdXRoU2VydmljZV0gPSB1c2VTdGF0ZSgoKSA9PiBuZXcgT0F1dGhTZXJ2aWNlKCkpXG4gIGNvbnN0IFtsb2dpbldpdGhDbGF1ZGVBaSwgc2V0TG9naW5XaXRoQ2xhdWRlQWldID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIC8vIFVzZSBDbGF1ZGUgQUkgYXV0aCBmb3Igc2V0dXAtdG9rZW4gbW9kZSB0byBzdXBwb3J0IHVzZXI6aW5mZXJlbmNlIHNjb3BlXG4gICAgcmV0dXJuIG1vZGUgPT09ICdzZXR1cC10b2tlbicgfHwgZm9yY2VMb2dpbk1ldGhvZCA9PT0gJ2NsYXVkZWFpJ1xuICB9KVxuICAvLyBBZnRlciBhIGZldyBzZWNvbmRzIHdlIHN1Z2dlc3QgdGhlIHVzZXIgdG8gY29weS9wYXN0ZSB1cmwgaWYgdGhlXG4gIC8vIGJyb3dzZXIgZGlkIG5vdCBvcGVuIGF1dG9tYXRpY2FsbHkuIEluIHRoaXMgZmxvdyB3ZSBleHBlY3QgdGhlIHVzZXIgdG9cbiAgLy8gY29weSB0aGUgY29kZSBmcm9tIHRoZSBicm93c2VyIGFuZCBwYXN0ZSBpdCBpbiB0aGUgdGVybWluYWxcbiAgY29uc3QgW3Nob3dQYXN0ZVByb21wdCwgc2V0U2hvd1Bhc3RlUHJvbXB0XSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbdXJsQ29waWVkLCBzZXRVcmxDb3BpZWRdID0gdXNlU3RhdGUoZmFsc2UpXG5cbiAgY29uc3QgdGV4dElucHV0Q29sdW1ucyA9IHVzZVRlcm1pbmFsU2l6ZSgpLmNvbHVtbnMgLSBQQVNURV9IRVJFX01TRy5sZW5ndGggLSAxXG5cbiAgLy8gTG9nIGZvcmNlZCBsb2dpbiBtZXRob2Qgb24gbW91bnRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoZm9yY2VMb2dpbk1ldGhvZCA9PT0gJ2NsYXVkZWFpJykge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X29hdXRoX2NsYXVkZWFpX2ZvcmNlZCcsIHt9KVxuICAgIH0gZWxzZSBpZiAoZm9yY2VMb2dpbk1ldGhvZCA9PT0gJ2NvbnNvbGUnKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3Vfb2F1dGhfY29uc29sZV9mb3JjZWQnLCB7fSlcbiAgICB9XG4gIH0sIFtmb3JjZUxvZ2luTWV0aG9kXSlcblxuICAvLyBSZXRyeSBsb2dpY1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChvYXV0aFN0YXR1cy5zdGF0ZSA9PT0gJ2Fib3V0X3RvX3JldHJ5Jykge1xuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KHNldE9BdXRoU3RhdHVzLCAxMDAwLCBvYXV0aFN0YXR1cy5uZXh0U3RhdGUpXG4gICAgICByZXR1cm4gKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVyKVxuICAgIH1cbiAgfSwgW29hdXRoU3RhdHVzXSlcblxuICAvLyBIYW5kbGUgRW50ZXIgdG8gY29udGludWUgb24gc3VjY2VzcyBzdGF0ZVxuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOnllcycsXG4gICAgKCkgPT4ge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X29hdXRoX3N1Y2Nlc3MnLCB7IGxvZ2luV2l0aENsYXVkZUFpIH0pXG4gICAgICBvbkRvbmUoKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogb2F1dGhTdGF0dXMuc3RhdGUgPT09ICdzdWNjZXNzJyAmJiBtb2RlICE9PSAnc2V0dXAtdG9rZW4nLFxuICAgIH0sXG4gIClcblxuICAvLyBIYW5kbGUgRW50ZXIgdG8gY29udGludWUgZnJvbSBwbGF0Zm9ybSBzZXR1cFxuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOnllcycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0T0F1dGhTdGF0dXMoeyBzdGF0ZTogJ2lkbGUnIH0pXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyxcbiAgICAgIGlzQWN0aXZlOiBvYXV0aFN0YXR1cy5zdGF0ZSA9PT0gJ3BsYXRmb3JtX3NldHVwJyxcbiAgICB9LFxuICApXG5cbiAgLy8gSGFuZGxlIEVudGVyIHRvIHJldHJ5IG9uIGVycm9yIHN0YXRlXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06eWVzJyxcbiAgICAoKSA9PiB7XG4gICAgICBpZiAob2F1dGhTdGF0dXMuc3RhdGUgPT09ICdlcnJvcicgJiYgb2F1dGhTdGF0dXMudG9SZXRyeSkge1xuICAgICAgICBzZXRQYXN0ZWRDb2RlKCcnKVxuICAgICAgICBzZXRPQXV0aFN0YXR1cyh7XG4gICAgICAgICAgc3RhdGU6ICdhYm91dF90b19yZXRyeScsXG4gICAgICAgICAgbmV4dFN0YXRlOiBvYXV0aFN0YXR1cy50b1JldHJ5LFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogb2F1dGhTdGF0dXMuc3RhdGUgPT09ICdlcnJvcicgJiYgISFvYXV0aFN0YXR1cy50b1JldHJ5LFxuICAgIH0sXG4gIClcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChcbiAgICAgIHBhc3RlZENvZGUgPT09ICdjJyAmJlxuICAgICAgb2F1dGhTdGF0dXMuc3RhdGUgPT09ICd3YWl0aW5nX2Zvcl9sb2dpbicgJiZcbiAgICAgIHNob3dQYXN0ZVByb21wdCAmJlxuICAgICAgIXVybENvcGllZFxuICAgICkge1xuICAgICAgdm9pZCBzZXRDbGlwYm9hcmQob2F1dGhTdGF0dXMudXJsKS50aGVuKHJhdyA9PiB7XG4gICAgICAgIGlmIChyYXcpIHByb2Nlc3Muc3Rkb3V0LndyaXRlKHJhdylcbiAgICAgICAgc2V0VXJsQ29waWVkKHRydWUpXG4gICAgICAgIHNldFRpbWVvdXQoc2V0VXJsQ29waWVkLCAyMDAwLCBmYWxzZSlcbiAgICAgIH0pXG4gICAgICBzZXRQYXN0ZWRDb2RlKCcnKVxuICAgIH1cbiAgfSwgW3Bhc3RlZENvZGUsIG9hdXRoU3RhdHVzLCBzaG93UGFzdGVQcm9tcHQsIHVybENvcGllZF0pXG5cbiAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU3VibWl0Q29kZSh2YWx1ZTogc3RyaW5nLCB1cmw6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAvLyBFeHBlY3RpbmcgZm9ybWF0IFwiYXV0aG9yaXphdGlvbkNvZGUjc3RhdGVcIiBmcm9tIHRoZSBhdXRob3JpemF0aW9uIGNhbGxiYWNrIFVSTFxuICAgICAgY29uc3QgW2F1dGhvcml6YXRpb25Db2RlLCBzdGF0ZV0gPSB2YWx1ZS5zcGxpdCgnIycpXG5cbiAgICAgIGlmICghYXV0aG9yaXphdGlvbkNvZGUgfHwgIXN0YXRlKSB7XG4gICAgICAgIHNldE9BdXRoU3RhdHVzKHtcbiAgICAgICAgICBzdGF0ZTogJ2Vycm9yJyxcbiAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBjb2RlLiBQbGVhc2UgbWFrZSBzdXJlIHRoZSBmdWxsIGNvZGUgd2FzIGNvcGllZCcsXG4gICAgICAgICAgdG9SZXRyeTogeyBzdGF0ZTogJ3dhaXRpbmdfZm9yX2xvZ2luJywgdXJsIH0sXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBUcmFjayB3aGljaCBwYXRoIHRoZSB1c2VyIGlzIHRha2luZyAobWFudWFsIGNvZGUgZW50cnkpXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfb2F1dGhfbWFudWFsX2VudHJ5Jywge30pXG4gICAgICBvYXV0aFNlcnZpY2UuaGFuZGxlTWFudWFsQXV0aENvZGVJbnB1dCh7XG4gICAgICAgIGF1dGhvcml6YXRpb25Db2RlLFxuICAgICAgICBzdGF0ZSxcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyOiB1bmtub3duKSB7XG4gICAgICBsb2dFcnJvcihlcnIpXG4gICAgICBzZXRPQXV0aFN0YXR1cyh7XG4gICAgICAgIHN0YXRlOiAnZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiAoZXJyIGFzIEVycm9yKS5tZXNzYWdlLFxuICAgICAgICB0b1JldHJ5OiB7IHN0YXRlOiAnd2FpdGluZ19mb3JfbG9naW4nLCB1cmwgfSxcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgY29uc3Qgc3RhcnRPQXV0aCA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X29hdXRoX2Zsb3dfc3RhcnQnLCB7IGxvZ2luV2l0aENsYXVkZUFpIH0pXG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG9hdXRoU2VydmljZVxuICAgICAgICAuc3RhcnRPQXV0aEZsb3coXG4gICAgICAgICAgYXN5bmMgdXJsID0+IHtcbiAgICAgICAgICAgIHNldE9BdXRoU3RhdHVzKHsgc3RhdGU6ICd3YWl0aW5nX2Zvcl9sb2dpbicsIHVybCB9KVxuICAgICAgICAgICAgc2V0VGltZW91dChzZXRTaG93UGFzdGVQcm9tcHQsIDMwMDAsIHRydWUpXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2dpbldpdGhDbGF1ZGVBaSxcbiAgICAgICAgICAgIGluZmVyZW5jZU9ubHk6IG1vZGUgPT09ICdzZXR1cC10b2tlbicsXG4gICAgICAgICAgICBleHBpcmVzSW46IG1vZGUgPT09ICdzZXR1cC10b2tlbicgPyAzNjUgKiAyNCAqIDYwICogNjAgOiB1bmRlZmluZWQsIC8vIDEgeWVhciBmb3Igc2V0dXAtdG9rZW5cbiAgICAgICAgICAgIG9yZ1VVSUQsXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICBjb25zdCBpc1Rva2VuRXhjaGFuZ2VFcnJvciA9IGVyci5tZXNzYWdlLmluY2x1ZGVzKFxuICAgICAgICAgICAgJ1Rva2VuIGV4Y2hhbmdlIGZhaWxlZCcsXG4gICAgICAgICAgKVxuICAgICAgICAgIC8vIEVudGVycHJpc2UgVExTIHByb3hpZXMgKFpzY2FsZXIgZXQgYWwuKSBpbnRlcmNlcHQgdGhlIHRva2VuXG4gICAgICAgICAgLy8gZXhjaGFuZ2UgUE9TVCBhbmQgY2F1c2UgY3J5cHRpYyBTU0wgZXJyb3JzLiBTdXJmYWNlIGFuXG4gICAgICAgICAgLy8gYWN0aW9uYWJsZSBoaW50IHNvIHRoZSB1c2VyIGlzbid0IHN0dWNrIGluIGEgbG9naW4gbG9vcC5cbiAgICAgICAgICBjb25zdCBzc2xIaW50ID0gZ2V0U1NMRXJyb3JIaW50KGVycilcbiAgICAgICAgICBzZXRPQXV0aFN0YXR1cyh7XG4gICAgICAgICAgICBzdGF0ZTogJ2Vycm9yJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgICAgIHNzbEhpbnQgPz9cbiAgICAgICAgICAgICAgKGlzVG9rZW5FeGNoYW5nZUVycm9yXG4gICAgICAgICAgICAgICAgPyAnRmFpbGVkIHRvIGV4Y2hhbmdlIGF1dGhvcml6YXRpb24gY29kZSBmb3IgYWNjZXNzIHRva2VuLiBQbGVhc2UgdHJ5IGFnYWluLidcbiAgICAgICAgICAgICAgICA6IGVyci5tZXNzYWdlKSxcbiAgICAgICAgICAgIHRvUmV0cnk6XG4gICAgICAgICAgICAgIG1vZGUgPT09ICdzZXR1cC10b2tlbidcbiAgICAgICAgICAgICAgICA/IHsgc3RhdGU6ICdyZWFkeV90b19zdGFydCcgfVxuICAgICAgICAgICAgICAgIDogeyBzdGF0ZTogJ2lkbGUnIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfb2F1dGhfdG9rZW5fZXhjaGFuZ2VfZXJyb3InLCB7XG4gICAgICAgICAgICBlcnJvcjogZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICBzc2xfZXJyb3I6IHNzbEhpbnQgIT09IG51bGwsXG4gICAgICAgICAgfSlcbiAgICAgICAgICB0aHJvdyBlcnJcbiAgICAgICAgfSlcblxuICAgICAgaWYgKG1vZGUgPT09ICdzZXR1cC10b2tlbicpIHtcbiAgICAgICAgLy8gRm9yIHNldHVwLXRva2VuIG1vZGUsIHJldHVybiB0aGUgT0F1dGggYWNjZXNzIHRva2VuIGRpcmVjdGx5IChpdCBjYW4gYmUgdXNlZCBhcyBhbiBBUEkga2V5KVxuICAgICAgICAvLyBEb24ndCBzYXZlIHRvIGtleWNoYWluIC0gdGhlIHRva2VuIGlzIGRpc3BsYXllZCBmb3IgbWFudWFsIHVzZSB3aXRoIENMQVVERV9DT0RFX09BVVRIX1RPS0VOXG4gICAgICAgIHNldE9BdXRoU3RhdHVzKHsgc3RhdGU6ICdzdWNjZXNzJywgdG9rZW46IHJlc3VsdC5hY2Nlc3NUb2tlbiB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgaW5zdGFsbE9BdXRoVG9rZW5zKHJlc3VsdClcblxuICAgICAgICBjb25zdCBvcmdSZXN1bHQgPSBhd2FpdCB2YWxpZGF0ZUZvcmNlTG9naW5PcmcoKVxuICAgICAgICBpZiAoIW9yZ1Jlc3VsdC52YWxpZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihvcmdSZXN1bHQubWVzc2FnZSlcbiAgICAgICAgfVxuXG4gICAgICAgIHNldE9BdXRoU3RhdHVzKHsgc3RhdGU6ICdzdWNjZXNzJyB9KVxuICAgICAgICB2b2lkIHNlbmROb3RpZmljYXRpb24oXG4gICAgICAgICAge1xuICAgICAgICAgICAgbWVzc2FnZTogJ0NsYXVkZSBDb2RlIGxvZ2luIHN1Y2Nlc3NmdWwnLFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uVHlwZTogJ2F1dGhfc3VjY2VzcycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0ZXJtaW5hbCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID0gKGVyciBhcyBFcnJvcikubWVzc2FnZVxuICAgICAgY29uc3Qgc3NsSGludCA9IGdldFNTTEVycm9ySGludChlcnIpXG4gICAgICBzZXRPQXV0aFN0YXR1cyh7XG4gICAgICAgIHN0YXRlOiAnZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBzc2xIaW50ID8/IGVycm9yTWVzc2FnZSxcbiAgICAgICAgdG9SZXRyeToge1xuICAgICAgICAgIHN0YXRlOiBtb2RlID09PSAnc2V0dXAtdG9rZW4nID8gJ3JlYWR5X3RvX3N0YXJ0JyA6ICdpZGxlJyxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfb2F1dGhfZXJyb3InLCB7XG4gICAgICAgIGVycm9yOlxuICAgICAgICAgIGVycm9yTWVzc2FnZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICBzc2xfZXJyb3I6IHNzbEhpbnQgIT09IG51bGwsXG4gICAgICB9KVxuICAgIH1cbiAgfSwgW29hdXRoU2VydmljZSwgc2V0U2hvd1Bhc3RlUHJvbXB0LCBsb2dpbldpdGhDbGF1ZGVBaSwgbW9kZSwgb3JnVVVJRF0pXG5cbiAgY29uc3QgcGVuZGluZ09BdXRoU3RhcnRSZWYgPSB1c2VSZWYoZmFsc2UpXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXG4gICAgICBvYXV0aFN0YXR1cy5zdGF0ZSA9PT0gJ3JlYWR5X3RvX3N0YXJ0JyAmJlxuICAgICAgIXBlbmRpbmdPQXV0aFN0YXJ0UmVmLmN1cnJlbnRcbiAgICApIHtcbiAgICAgIHBlbmRpbmdPQXV0aFN0YXJ0UmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKFxuICAgICAgICAoXG4gICAgICAgICAgc3RhcnRPQXV0aDogKCkgPT4gUHJvbWlzZTx2b2lkPixcbiAgICAgICAgICBwZW5kaW5nT0F1dGhTdGFydFJlZjogUmVhY3QuTXV0YWJsZVJlZk9iamVjdDxib29sZWFuPixcbiAgICAgICAgKSA9PiB7XG4gICAgICAgICAgdm9pZCBzdGFydE9BdXRoKClcbiAgICAgICAgICBwZW5kaW5nT0F1dGhTdGFydFJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAgICAgfSxcbiAgICAgICAgc3RhcnRPQXV0aCxcbiAgICAgICAgcGVuZGluZ09BdXRoU3RhcnRSZWYsXG4gICAgICApXG4gICAgfVxuICB9LCBbb2F1dGhTdGF0dXMuc3RhdGUsIHN0YXJ0T0F1dGhdKVxuXG4gIC8vIEF1dG8tZXhpdCBmb3Igc2V0dXAtdG9rZW4gbW9kZVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChtb2RlID09PSAnc2V0dXAtdG9rZW4nICYmIG9hdXRoU3RhdHVzLnN0YXRlID09PSAnc3VjY2VzcycpIHtcbiAgICAgIC8vIERlbGF5IHRvIGVuc3VyZSBzdGF0aWMgY29udGVudCBpcyBmdWxseSByZW5kZXJlZCBiZWZvcmUgZXhpdGluZ1xuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAobG9naW5XaXRoQ2xhdWRlQWksIG9uRG9uZSkgPT4ge1xuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9vYXV0aF9zdWNjZXNzJywgeyBsb2dpbldpdGhDbGF1ZGVBaSB9KVxuICAgICAgICAgIC8vIERvbid0IGNsZWFyIHRlcm1pbmFsIHNvIHRoZSB0b2tlbiByZW1haW5zIHZpc2libGVcbiAgICAgICAgICBvbkRvbmUoKVxuICAgICAgICB9LFxuICAgICAgICA1MDAsXG4gICAgICAgIGxvZ2luV2l0aENsYXVkZUFpLFxuICAgICAgICBvbkRvbmUsXG4gICAgICApXG4gICAgICByZXR1cm4gKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVyKVxuICAgIH1cbiAgfSwgW21vZGUsIG9hdXRoU3RhdHVzLCBsb2dpbldpdGhDbGF1ZGVBaSwgb25Eb25lXSlcblxuICAvLyBDbGVhbnVwIE9BdXRoIHNlcnZpY2Ugd2hlbiBjb21wb25lbnQgdW5tb3VudHNcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgb2F1dGhTZXJ2aWNlLmNsZWFudXAoKVxuICAgIH1cbiAgfSwgW29hdXRoU2VydmljZV0pXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAge29hdXRoU3RhdHVzLnN0YXRlID09PSAnd2FpdGluZ19mb3JfbG9naW4nICYmIHNob3dQYXN0ZVByb21wdCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGtleT1cInVybFRvQ29weVwiIGdhcD17MX0gcGFkZGluZ0JvdHRvbT17MX0+XG4gICAgICAgICAgPEJveCBwYWRkaW5nWD17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgQnJvd3NlciBkaWRuJmFwb3M7dCBvcGVuPyBVc2UgdGhlIHVybCBiZWxvdyB0byBzaWduIGlueycgJ31cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHt1cmxDb3BpZWQgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiPihDb3BpZWQhKTwvVGV4dD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cImNcIiBhY3Rpb249XCJjb3B5XCIgcGFyZW5zIC8+XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPExpbmsgdXJsPXtvYXV0aFN0YXR1cy51cmx9PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e29hdXRoU3RhdHVzLnVybH08L1RleHQ+XG4gICAgICAgICAgPC9MaW5rPlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7bW9kZSA9PT0gJ3NldHVwLXRva2VuJyAmJlxuICAgICAgICBvYXV0aFN0YXR1cy5zdGF0ZSA9PT0gJ3N1Y2Nlc3MnICYmXG4gICAgICAgIG9hdXRoU3RhdHVzLnRva2VuICYmIChcbiAgICAgICAgICA8Qm94IGtleT1cInRva2VuT3V0cHV0XCIgZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0gcGFkZGluZ1RvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj5cbiAgICAgICAgICAgICAg4pyTIExvbmctbGl2ZWQgYXV0aGVudGljYXRpb24gdG9rZW4gY3JlYXRlZCBzdWNjZXNzZnVsbHkhXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICAgICAgICA8VGV4dD5Zb3VyIE9BdXRoIHRva2VuICh2YWxpZCBmb3IgMSB5ZWFyKTo8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPntvYXV0aFN0YXR1cy50b2tlbn08L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIFN0b3JlIHRoaXMgdG9rZW4gc2VjdXJlbHkuIFlvdSB3b24mYXBvczt0IGJlIGFibGUgdG8gc2VlIGl0XG4gICAgICAgICAgICAgICAgYWdhaW4uXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgVXNlIHRoaXMgdG9rZW4gYnkgc2V0dGluZzogZXhwb3J0XG4gICAgICAgICAgICAgICAgQ0xBVURFX0NPREVfT0FVVEhfVE9LRU49Jmx0O3Rva2VuJmd0O1xuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICA8T0F1dGhTdGF0dXNNZXNzYWdlXG4gICAgICAgICAgb2F1dGhTdGF0dXM9e29hdXRoU3RhdHVzfVxuICAgICAgICAgIG1vZGU9e21vZGV9XG4gICAgICAgICAgc3RhcnRpbmdNZXNzYWdlPXtzdGFydGluZ01lc3NhZ2V9XG4gICAgICAgICAgZm9yY2VkTWV0aG9kTWVzc2FnZT17Zm9yY2VkTWV0aG9kTWVzc2FnZX1cbiAgICAgICAgICBzaG93UGFzdGVQcm9tcHQ9e3Nob3dQYXN0ZVByb21wdH1cbiAgICAgICAgICBwYXN0ZWRDb2RlPXtwYXN0ZWRDb2RlfVxuICAgICAgICAgIHNldFBhc3RlZENvZGU9e3NldFBhc3RlZENvZGV9XG4gICAgICAgICAgY3Vyc29yT2Zmc2V0PXtjdXJzb3JPZmZzZXR9XG4gICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0PXtzZXRDdXJzb3JPZmZzZXR9XG4gICAgICAgICAgdGV4dElucHV0Q29sdW1ucz17dGV4dElucHV0Q29sdW1uc31cbiAgICAgICAgICBoYW5kbGVTdWJtaXRDb2RlPXtoYW5kbGVTdWJtaXRDb2RlfVxuICAgICAgICAgIHNldE9BdXRoU3RhdHVzPXtzZXRPQXV0aFN0YXR1c31cbiAgICAgICAgICBzZXRMb2dpbldpdGhDbGF1ZGVBaT17c2V0TG9naW5XaXRoQ2xhdWRlQWl9XG4gICAgICAgIC8+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG50eXBlIE9BdXRoU3RhdHVzTWVzc2FnZVByb3BzID0ge1xuICBvYXV0aFN0YXR1czogT0F1dGhTdGF0dXNcbiAgbW9kZTogJ2xvZ2luJyB8ICdzZXR1cC10b2tlbidcbiAgc3RhcnRpbmdNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgZm9yY2VkTWV0aG9kTWVzc2FnZTogc3RyaW5nIHwgbnVsbFxuICBzaG93UGFzdGVQcm9tcHQ6IGJvb2xlYW5cbiAgcGFzdGVkQ29kZTogc3RyaW5nXG4gIHNldFBhc3RlZENvZGU6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG4gIGN1cnNvck9mZnNldDogbnVtYmVyXG4gIHNldEN1cnNvck9mZnNldDogKG9mZnNldDogbnVtYmVyKSA9PiB2b2lkXG4gIHRleHRJbnB1dENvbHVtbnM6IG51bWJlclxuICBoYW5kbGVTdWJtaXRDb2RlOiAodmFsdWU6IHN0cmluZywgdXJsOiBzdHJpbmcpID0+IHZvaWRcbiAgc2V0T0F1dGhTdGF0dXM6IChzdGF0dXM6IE9BdXRoU3RhdHVzKSA9PiB2b2lkXG4gIHNldExvZ2luV2l0aENsYXVkZUFpOiAodmFsdWU6IGJvb2xlYW4pID0+IHZvaWRcbn1cblxuZnVuY3Rpb24gT0F1dGhTdGF0dXNNZXNzYWdlKHtcbiAgb2F1dGhTdGF0dXMsXG4gIG1vZGUsXG4gIHN0YXJ0aW5nTWVzc2FnZSxcbiAgZm9yY2VkTWV0aG9kTWVzc2FnZSxcbiAgc2hvd1Bhc3RlUHJvbXB0LFxuICBwYXN0ZWRDb2RlLFxuICBzZXRQYXN0ZWRDb2RlLFxuICBjdXJzb3JPZmZzZXQsXG4gIHNldEN1cnNvck9mZnNldCxcbiAgdGV4dElucHV0Q29sdW1ucyxcbiAgaGFuZGxlU3VibWl0Q29kZSxcbiAgc2V0T0F1dGhTdGF0dXMsXG4gIHNldExvZ2luV2l0aENsYXVkZUFpLFxufTogT0F1dGhTdGF0dXNNZXNzYWdlUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBzd2l0Y2ggKG9hdXRoU3RhdHVzLnN0YXRlKSB7XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD5cbiAgICAgICAgICAgIHtzdGFydGluZ01lc3NhZ2VcbiAgICAgICAgICAgICAgPyBzdGFydGluZ01lc3NhZ2VcbiAgICAgICAgICAgICAgOiBgQ2xhdWRlIENvZGUgY2FuIGJlIHVzZWQgd2l0aCB5b3VyIENsYXVkZSBzdWJzY3JpcHRpb24gb3IgYmlsbGVkIGJhc2VkIG9uIEFQSSB1c2FnZSB0aHJvdWdoIHlvdXIgQ29uc29sZSBhY2NvdW50LmB9XG4gICAgICAgICAgPC9UZXh0PlxuXG4gICAgICAgICAgPFRleHQ+U2VsZWN0IGxvZ2luIG1ldGhvZDo8L1RleHQ+XG5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBvcHRpb25zPXtbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgQ2xhdWRlIGFjY291bnQgd2l0aCBzdWJzY3JpcHRpb24gwrd7JyAnfVxuICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlBybywgTWF4LCBUZWFtLCBvciBFbnRlcnByaXNlPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIHtcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7J1xcbid9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPltBTlQtT05MWV08L1RleHQ+eycgJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUGxlYXNlIHVzZSB0aGlzIG9wdGlvbiB1bmxlc3MgeW91IG5lZWQgdG8gbG9naW4gdG8gYVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwZWNpYWwgb3JnIGZvciBhY2Nlc3Npbmcgc2Vuc2l0aXZlIGRhdGEgKGUuZy5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21lciBkYXRhLCBISVBJIGRhdGEpIHdpdGggdGhlIENvbnNvbGUgb3B0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIHsnXFxuJ31cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiAnY2xhdWRlYWknLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6IChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgQW50aHJvcGljIENvbnNvbGUgYWNjb3VudCDCt3snICd9XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+QVBJIHVzYWdlIGJpbGxpbmc8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgeydcXG4nfVxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgdmFsdWU6ICdjb25zb2xlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIGxhYmVsOiAoXG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIDNyZC1wYXJ0eSBwbGF0Zm9ybSDCt3snICd9XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgICBBbWF6b24gQmVkcm9jaywgTWljcm9zb2Z0IEZvdW5kcnksIG9yIFZlcnRleCBBSVxuICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICB7J1xcbid9XG4gICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogJ3BsYXRmb3JtJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17dmFsdWUgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gJ3BsYXRmb3JtJykge1xuICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X29hdXRoX3BsYXRmb3JtX3NlbGVjdGVkJywge30pXG4gICAgICAgICAgICAgICAgICBzZXRPQXV0aFN0YXR1cyh7IHN0YXRlOiAncGxhdGZvcm1fc2V0dXAnIH0pXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldE9BdXRoU3RhdHVzKHsgc3RhdGU6ICdyZWFkeV90b19zdGFydCcgfSlcbiAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gJ2NsYXVkZWFpJykge1xuICAgICAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfb2F1dGhfY2xhdWRlYWlfc2VsZWN0ZWQnLCB7fSlcbiAgICAgICAgICAgICAgICAgICAgc2V0TG9naW5XaXRoQ2xhdWRlQWkodHJ1ZSlcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9vYXV0aF9jb25zb2xlX3NlbGVjdGVkJywge30pXG4gICAgICAgICAgICAgICAgICAgIHNldExvZ2luV2l0aENsYXVkZUFpKGZhbHNlKVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgY2FzZSAncGxhdGZvcm1fc2V0dXAnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfSBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+VXNpbmcgM3JkLXBhcnR5IHBsYXRmb3JtczwvVGV4dD5cblxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgQ2xhdWRlIENvZGUgc3VwcG9ydHMgQW1hem9uIEJlZHJvY2ssIE1pY3Jvc29mdCBGb3VuZHJ5LCBhbmQgVmVydGV4XG4gICAgICAgICAgICAgIEFJLiBTZXQgdGhlIHJlcXVpcmVkIGVudmlyb25tZW50IHZhcmlhYmxlcywgdGhlbiByZXN0YXJ0IENsYXVkZVxuICAgICAgICAgICAgICBDb2RlLlxuICAgICAgICAgICAgPC9UZXh0PlxuXG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgSWYgeW91IGFyZSBwYXJ0IG9mIGFuIGVudGVycHJpc2Ugb3JnYW5pemF0aW9uLCBjb250YWN0IHlvdXJcbiAgICAgICAgICAgICAgYWRtaW5pc3RyYXRvciBmb3Igc2V0dXAgaW5zdHJ1Y3Rpb25zLlxuICAgICAgICAgICAgPC9UZXh0PlxuXG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBib2xkPkRvY3VtZW50YXRpb246PC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgICDCtyBBbWF6b24gQmVkcm9jazp7JyAnfVxuICAgICAgICAgICAgICAgIDxMaW5rIHVybD1cImh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vYW1hem9uLWJlZHJvY2tcIj5cbiAgICAgICAgICAgICAgICAgIGh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vYW1hem9uLWJlZHJvY2tcbiAgICAgICAgICAgICAgICA8L0xpbms+XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgwrcgTWljcm9zb2Z0IEZvdW5kcnk6eycgJ31cbiAgICAgICAgICAgICAgICA8TGluayB1cmw9XCJodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL21pY3Jvc29mdC1mb3VuZHJ5XCI+XG4gICAgICAgICAgICAgICAgICBodHRwczovL2NvZGUuY2xhdWRlLmNvbS9kb2NzL2VuL21pY3Jvc29mdC1mb3VuZHJ5XG4gICAgICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgIMK3IFZlcnRleCBBSTp7JyAnfVxuICAgICAgICAgICAgICAgIDxMaW5rIHVybD1cImh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vZ29vZ2xlLXZlcnRleC1haVwiPlxuICAgICAgICAgICAgICAgICAgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9nb29nbGUtdmVydGV4LWFpXG4gICAgICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cblxuICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICBQcmVzcyA8VGV4dCBib2xkPkVudGVyPC9UZXh0PiB0byBnbyBiYWNrIHRvIGxvZ2luIG9wdGlvbnMuXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgIClcblxuICAgIGNhc2UgJ3dhaXRpbmdfZm9yX2xvZ2luJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICAgICAge2ZvcmNlZE1ldGhvZE1lc3NhZ2UgJiYgKFxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2ZvcmNlZE1ldGhvZE1lc3NhZ2V9PC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHshc2hvd1Bhc3RlUHJvbXB0ICYmIChcbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgICAgICAgIDxUZXh0Pk9wZW5pbmcgYnJvd3NlciB0byBzaWduIGlu4oCmPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHtzaG93UGFzdGVQcm9tcHQgJiYgKFxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQ+e1BBU1RFX0hFUkVfTVNHfTwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHRJbnB1dFxuICAgICAgICAgICAgICAgIHZhbHVlPXtwYXN0ZWRDb2RlfVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtzZXRQYXN0ZWRDb2RlfVxuICAgICAgICAgICAgICAgIG9uU3VibWl0PXsodmFsdWU6IHN0cmluZykgPT5cbiAgICAgICAgICAgICAgICAgIGhhbmRsZVN1Ym1pdENvZGUodmFsdWUsIG9hdXRoU3RhdHVzLnVybClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3Vyc29yT2Zmc2V0PXtjdXJzb3JPZmZzZXR9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2VDdXJzb3JPZmZzZXQ9e3NldEN1cnNvck9mZnNldH1cbiAgICAgICAgICAgICAgICBjb2x1bW5zPXt0ZXh0SW5wdXRDb2x1bW5zfVxuICAgICAgICAgICAgICAgIG1hc2s9XCIqXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgY2FzZSAnY3JlYXRpbmdfYXBpX2tleSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICA8U3Bpbm5lciAvPlxuICAgICAgICAgICAgPFRleHQ+Q3JlYXRpbmcgQVBJIGtleSBmb3IgQ2xhdWRlIENvZGXigKY8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgY2FzZSAnYWJvdXRfdG9fcmV0cnknOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInBlcm1pc3Npb25cIj5SZXRyeWluZ+KApjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApXG5cbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIHttb2RlID09PSAnc2V0dXAtdG9rZW4nICYmIG9hdXRoU3RhdHVzLnRva2VuID8gbnVsbCA6IChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIHtnZXRPYXV0aEFjY291bnRJbmZvKCk/LmVtYWlsQWRkcmVzcyA/IChcbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgIExvZ2dlZCBpbiBhc3snICd9XG4gICAgICAgICAgICAgICAgICA8VGV4dD57Z2V0T2F1dGhBY2NvdW50SW5mbygpPy5lbWFpbEFkZHJlc3N9PC9UZXh0PlxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgKSA6IG51bGx9XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiPlxuICAgICAgICAgICAgICAgIExvZ2luIHN1Y2Nlc3NmdWwuIFByZXNzIDxUZXh0IGJvbGQ+RW50ZXI8L1RleHQ+IHRvIGNvbnRpbnVl4oCmXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgY2FzZSAnZXJyb3InOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+T0F1dGggZXJyb3I6IHtvYXV0aFN0YXR1cy5tZXNzYWdlfTwvVGV4dD5cblxuICAgICAgICAgIHtvYXV0aFN0YXR1cy50b1JldHJ5ICYmIChcbiAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJwZXJtaXNzaW9uXCI+XG4gICAgICAgICAgICAgICAgUHJlc3MgPFRleHQgYm9sZD5FbnRlcjwvVGV4dD4gdG8gcmV0cnkuXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLEtBQUssSUFBSUMsV0FBVyxFQUFFQyxTQUFTLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDdkUsU0FDRSxLQUFLQywwREFBMEQsRUFDL0RDLFFBQVEsUUFDSCxpQ0FBaUM7QUFDeEMsU0FBU0Msa0JBQWtCLFFBQVEseUJBQXlCO0FBQzVELFNBQVNDLGVBQWUsUUFBUSw2QkFBNkI7QUFDN0QsU0FBU0MsWUFBWSxRQUFRLHNCQUFzQjtBQUNuRCxTQUFTQyx1QkFBdUIsUUFBUSxtQ0FBbUM7QUFDM0UsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLEVBQUVDLElBQUksUUFBUSxXQUFXO0FBQzNDLFNBQVNDLGFBQWEsUUFBUSxpQ0FBaUM7QUFDL0QsU0FBU0MsZUFBZSxRQUFRLCtCQUErQjtBQUMvRCxTQUFTQyxn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