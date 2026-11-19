export class HiveClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async registerSession(req) {
        return this.post('/api/sessions/register', req);
    }
    async endSession(req) {
        await this.post('/api/sessions/end', req);
    }
    async sendIntent(req) {
        return this.post('/api/signals/intent', req);
    }
    async sendActivity(req) {
        return this.post('/api/signals/activity', req);
    }
    async checkConflicts(session_id, file_path, repo) {
        const params = new URLSearchParams({ session_id, file_path });
        if (repo)
            params.set('repo', repo);
        return this.get(`/api/conflicts/check?${params}`);
    }
    async listActive(repo) {
        const params = repo ? `?repo=${encodeURIComponent(repo)}` : '';
        return this.get(`/api/sessions/active${params}`);
    }
    async heartbeat(session_id) {
        await this.post('/api/sessions/heartbeat', { session_id });
    }
    async post(path, body) {
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok)
                return null;
            return res.json();
        }
        catch {
            return null; // Backend unreachable — never block the developer
        }
    }
    async get(path) {
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                signal: AbortSignal.timeout(3000),
            });
            if (!res.ok)
                return null;
            return res.json();
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=hive-client.js.map