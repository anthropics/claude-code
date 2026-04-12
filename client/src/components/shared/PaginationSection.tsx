import { setCurrentPage as setUserCurrentPage } from "@/lib/redux/features/users/userSlice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks/typedHooks";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "../ui/pagination";

import { setCurrentPage as setPostCurrentPage } from "@/lib/redux/features/posts/postSlice";

interface PaginationSectionProps {
	totalPages: number;
	entityType: "user" | "post";
}

const PaginationSection = ({
	totalPages,
	entityType,
}: PaginationSectionProps) => {
	const dispatch = useAppDispatch();

	const currentPage = useAppSelector((state) =>
		entityType === "user" ? state.user.page : state.post.page,
	);

	const setCurrentPageAction =
		entityType === "user" ? setUserCurrentPage : setPostCurrentPage;

	const handlePreviousClick = () => {
		if (currentPage > 1) dispatch(setCurrentPageAction(currentPage - 1));
	};

	const handleNextClick = () => {
		if (currentPage < totalPages)
			dispatch(setCurrentPageAction(currentPage + 1));
	};

	return (
		<Pagination className="bg-platinum dark:bg-eerieBlack dark:text-platinum mt-4 rounded-full">
			<PaginationContent>
				<PaginationItem className="cursor-pointer">
					<PaginationPrevious onClick={handlePreviousClick} />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink className="h3-semibold font-robotoSlab dark:text-veryBlack inline-flex items-center rounded-md border border-transparent bg-lime-500">
						{currentPage}
					</PaginationLink>
				</PaginationItem>
				<PaginationItem className="cursor-pointer">
					<PaginationNext onClick={handleNextClick} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
};

export default PaginationSection;
