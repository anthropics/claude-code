import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
export function loadClientConfig() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    const configPath = join(home, '.open-hive.yaml');
    if (!existsSync(configPath))
        return null;
    const raw = readFileSync(configPath, 'utf-8');
    const lines = raw.split('\n');
    const config = {};
    let currentSection = '';
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed)
            continue;
        if (!line.startsWith(' ') && trimmed.endsWith(':')) {
            currentSection = trimmed.slice(0, -1);
            continue;
        }
        const match = trimmed.match(/^(\w+):\s*(.+)$/);
        if (match) {
            const key = currentSection ? `${currentSection}.${match[1]}` : match[1];
            config[key] = match[2].replace(/^["']|["']$/g, '');
        }
    }
    return {
        backend_url: config['backend_url'] ?? '',
        identity: {
            email: config['identity.email'] ?? getGitEmail(),
            display_name: config['identity.display_name'] ?? config['identity.email'] ?? 'Unknown',
        },
        team: config['team'],
        notifications: {
            inline: config['notifications.inline'] !== 'false',
            webhook_url: config['notifications.webhook_url'] || undefined,
        },
    };
}
function getGitEmail() {
    try {
        return execSync('git config user.email', { encoding: 'utf-8' }).trim();
    }
    catch {
        return 'unknown@localhost';
    }
}
//# sourceMappingURL=config.js.map