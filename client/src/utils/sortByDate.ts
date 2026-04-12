export const sortByDateDescending = <T>(arr: T[], property: keyof T): T[] => {
	return arr.slice().sort((a, b) => {
		return (
			new Date(b[property] as unknown as string).getTime() -
			new Date(a[property] as unknown as string).getTime()
		);
	});
};
