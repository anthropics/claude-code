import MockAdapter from "axios-mock-adapter";
import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import {
	createTweet,
	deleteTweet,
	fetchTweet,
	fetchTweetList,
	updateTweet,
} from "@/lib/api/tweets";

function stub() {
	const client = createApiClient();
	const mock = new MockAdapter(client);
	mock.onGet("/auth/csrf/").reply(200, { detail: "CSRF cookie set" });
	return { client, mock };
}

describe("tweets API", () => {
	it("createTweet POSTs body + tags to /tweets/", async () => {
		const { client, mock } = stub();
		mock.onPost("/tweets/").reply((config) => {
			const body = JSON.parse(config.data);
			expect(body.body).toBe("hello");
			expect(body.tags).toEqual(["python"]);
			return [201, { id: 1, body: "hello" }];
		});

		const tweet = await createTweet(
			{ body: "hello", tags: ["python"] },
			client,
		);
		expect(tweet.id).toBe(1);
	});

	it("fetchTweetList passes author + tag + page in query", async () => {
		const { client, mock } = stub();
		mock.onGet("/tweets/").reply((config) => {
			expect(config.params).toEqual({ author: "alice", tag: "py", page: 2 });
			return [200, { count: 0, next: null, previous: null, results: [] }];
		});
		await fetchTweetList({ author: "alice", tag: "py", page: 2 }, client);
	});

	it("fetchTweet hits /tweets/:id/", async () => {
		const { client, mock } = stub();
		mock.onGet("/tweets/42/").reply(200, { id: 42, body: "x" });
		const tweet = await fetchTweet(42, client);
		expect(tweet.id).toBe(42);
	});

	it("updateTweet PATCHes /tweets/:id/", async () => {
		const { client, mock } = stub();
		mock.onPatch("/tweets/42/").reply((config) => {
			expect(JSON.parse(config.data)).toEqual({ body: "edited" });
			return [200, { id: 42, body: "edited" }];
		});
		await updateTweet(42, { body: "edited" }, client);
	});

	it("deleteTweet DELETEs /tweets/:id/", async () => {
		const { client, mock } = stub();
		mock.onDelete("/tweets/42/").reply(204);
		await deleteTweet(42, client);
	});
});
