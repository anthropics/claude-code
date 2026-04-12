export function getRepliesText(count: number | undefined) {
	return `${count} ${count === 1 ? "Reply" : "Replies"}`;
}
