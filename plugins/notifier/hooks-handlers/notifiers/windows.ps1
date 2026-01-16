# windows.ps1 - Windows Toast Notification for Claude Code
# Called from notify.sh via Windows Native (Git Bash/MSYS2) or WSL

# Read configuration from environment variables
$MIN_DURATION = [int]$env:MIN_DURATION_SECONDS
if ($MIN_DURATION -eq 0) { $MIN_DURATION = 20 }

$NOTIFY_MSG = $env:NOTIFY_MESSAGE
if (-not $NOTIFY_MSG) { $NOTIFY_MSG = "Task completed!" }

$NOTIF_TYPE = $env:NOTIFICATION_TYPE

$DATA_DIR = $env:NOTIFIER_DATA_DIR_WIN
if (-not $DATA_DIR) {
    Write-Host "Error: NOTIFIER_DATA_DIR_WIN not set"
    exit 0
}

# UTF-8 encoding setup
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Load Toast Notification assemblies
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

# Read session_id from stdin (piped JSON)
$sessionId = "default"
try {
    $inputData = [Console]::In.ReadToEnd()
    if ($inputData) {
        $jsonData = $inputData | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($jsonData.session_id) {
            $sessionId = $jsonData.session_id
        }
    }
} catch {
    # Use default session ID on error
}

$escapedPrompt = ""

# For Notification hooks (permission_prompt, idle_prompt), skip duration check
if (-not $NOTIF_TYPE -or $NOTIF_TYPE -eq "null") {
    # Stop hook: check elapsed time
    $timestampFile = Join-Path $DATA_DIR "timestamp-$sessionId.txt"
    if (-not (Test-Path $timestampFile)) {
        exit 0
    }

    try {
        $startTime = [int](Get-Content $timestampFile -Raw -ErrorAction SilentlyContinue)
        $currentTime = [int](Get-Date -UFormat %s)
        $elapsed = $currentTime - $startTime

        # Skip notification if task was too short
        if ($elapsed -lt $MIN_DURATION) {
            exit 0
        }
    } catch {
        # Continue with notification on error
    }

    # Read prompt preview
    $promptFile = Join-Path $DATA_DIR "prompt-$sessionId.txt"

    if (Test-Path $promptFile) {
        try {
            $savedPrompt = Get-Content $promptFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if ($savedPrompt -and $savedPrompt.Trim()) {
                # Escape XML special characters
                $escapedPrompt = $savedPrompt.Trim()
                $escapedPrompt = $escapedPrompt -replace '&', '&amp;'
                $escapedPrompt = $escapedPrompt -replace '<', '&lt;'
                $escapedPrompt = $escapedPrompt -replace '>', '&gt;'
                $escapedPrompt = $escapedPrompt -replace '"', '&quot;'
                $escapedPrompt = $escapedPrompt -replace "'", '&apos;'
            }
        } catch {
            # Empty prompt on error
        }
    }
}

# Build Toast XML
$xml = [Windows.Data.Xml.Dom.XmlDocument]::new()

if ($escapedPrompt) {
    $toastXml = @"
<toast>
    <visual>
        <binding template="ToastText02">
            <text id="1">$NOTIFY_MSG</text>
            <text id="2">$escapedPrompt</text>
        </binding>
    </visual>
</toast>
"@
} else {
    $toastXml = @"
<toast>
    <visual>
        <binding template="ToastText01">
            <text id="1">$NOTIFY_MSG</text>
        </binding>
    </visual>
</toast>
"@
}

$xml.LoadXml($toastXml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($toast)

exit 0
