/**
 * Tweet CRUD API helpers (P1-16 / Issue #117).
 */

import type { AxiosInstance } from "axios";
import { api, ensureCsrfToken } from "@/lib/api/client";

export interface TweetImagePayload {
	image_url: string;
	width: number;
	height: number;
	order?: number;
}

export interface CreateTweetPayload {
	body: string;
	tags?: string[];
	images?: TweetImagePayload[];
}

export interface TweetSummary {
	id: number;
	body: string;
	html: string;
	char_count: number;
	author_handle: string;
	author_display_name?: string;
	author_avatar_url?: string;
	tags: string[];
	images: TweetImagePayload[];
	created_at: string;
	updated_at: string;
	edit_count: number;
}

export async function createTweet(
	payload: CreateTweetPayload,
	client: AxiosInstance = api,
): Promise<TweetSummary> {
	await ensureCsrfToken(client);
	const res = await client.post<TweetSummary>("/tweets/", payload);
	return res.data;
}

export interface TweetListPage {
	count: number;
	next: string | null;
	previous: string | null;
	results: TweetSummary[];
}

export interface TweetListParams {
	page?: number;
	author?: string;
	tag?: string;
}

export async function fetchTweetList(
	params: TweetListParams = {},
	client: AxiosInstance = api,
): Promise<TweetListPage> {
	const res = await client.get<TweetListPage>("/tweets/", { params });
	return res.data;
}

export async function fetchTweet(
	id: number | string,
	client: AxiosInstance = api,
): Promise<TweetSummary> {
	const res = await client.get<TweetSummary>(`/tweets/${id}/`);
	return res.data;
}

export async function updateTweet(
	id: number | string,
	payload: { body: string },
	client: AxiosInstance = api,
): Promise<TweetSummary> {
	await ensureCsrfToken(client);
	const res = await client.patch<TweetSummary>(`/tweets/${id}/`, payload);
	return res.data;
}

export async function deleteTweet(
	id: number | string,
	client: AxiosInstance = api,
): Promise<void> {
	await ensureCsrfToken(client);
	await client.delete(`/tweets/${id}/`);
}
