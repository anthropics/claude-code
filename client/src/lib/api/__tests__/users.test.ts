/**
 * users helper tests (P1-14).
 */

import MockAdapter from "axios-mock-adapter";
import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { completeOnboarding, fetchCurrentUser } from "@/lib/api/users";

function stub() {
	const client = createApiClient();
	const mock = new MockAdapter(client);
	mock.onGet("/auth/csrf/").reply(200, { detail: "CSRF cookie set" });
	return { client, mock };
}

describe("users API", () => {
	it("fetchCurrentUser GETs /users/me/", async () => {
		const { client, mock } = stub();
		mock.onGet("/users/me/").reply(200, {
			id: "u1",
			email: "a@b.com",
			username: "alice",
			needs_onboarding: true,
		});
		const user = await fetchCurrentUser(client);
		expect(user.username).toBe("alice");
		expect(user.needs_onboarding).toBe(true);
	});

	it("completeOnboarding POSTs display_name + bio and bootstraps CSRF", async () => {
		const { client, mock } = stub();
		mock.onPost("/users/me/complete_onboarding/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({
				display_name: "Alice",
				bio: "hi",
			});
			return [
				200,
				{
					id: "u1",
					email: "a@b.com",
					username: "alice",
					display_name: "Alice",
					bio: "hi",
					needs_onboarding: false,
				},
			];
		});

		const user = await completeOnboarding(
			{ display_name: "Alice", bio: "hi" },
			client,
		);

		expect(user.needs_onboarding).toBe(false);
		expect(mock.history.get.some((r) => r.url === "/auth/csrf/")).toBe(true);
	});

	it("completeOnboarding allows bio to be omitted", async () => {
		const { client, mock } = stub();
		mock.onPost("/users/me/complete_onboarding/").reply((config) => {
			const body = JSON.parse(config.data);
			expect(body.display_name).toBe("Alice");
			expect(body.bio).toBeUndefined();
			return [200, { id: "u1", display_name: "Alice", needs_onboarding: false }];
		});
		await completeOnboarding({ display_name: "Alice" }, client);
	});
});
