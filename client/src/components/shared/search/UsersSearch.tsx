"use client";

import { Input } from "@/components/ui/input";
import { setSearchTerm } from "@/lib/redux/features/users/userSlice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks/typedHooks";
import Image from "next/image";
import React from "react";

const UsersSearch = () => {
	const dispatch = useAppDispatch();
	const searchTerm = useAppSelector((state) => state.user.searchTerm);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		dispatch(setSearchTerm(event.target.value));
	};
	return (
		<div className="bg-gray dark:bg-eerieBlack mb-3 flex min-h-[56px] w-full grow rounded-full">
			<Image
				src="/assets/icons/search.svg"
				alt="Search"
				width={24}
				height={24}
				className="mx-3"
			/>
			<Input
				placeholder="Search by username, first or last name"
				type="search"
				value={searchTerm}
				onChange={handleInputChange}
				className="search-text no-focus dark:text-babyPowder border-none bg-transparent shadow-none outline-none"
			/>
		</div>
	);
};

export default UsersSearch;
