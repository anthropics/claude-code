import type { AxiosInstance } from "axios";
import { api } from "@/lib/api/client";

export interface TagSummary {
	name: string;
	display_name: string;
	description: string;
	usage_count: number;
	is_approved: boolean;
}

export async function searchTags(
	query: string,
	client: AxiosInstance = api,
): Promise<TagSummary[]> {
	if (!query) return [];
	const res = await client.get<TagSummary[] | { results: TagSummary[] }>(
		"/tags/",
		{ params: { q: query } },
	);
	const data = res.data;
	return Array.isArray(data) ? data : data.results ?? [];
}
