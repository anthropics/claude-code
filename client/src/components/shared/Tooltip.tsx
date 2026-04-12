import { ReactNode } from "react";

interface TooltipProps {
	children: ReactNode;
	content: ReactNode;
	position?: "bottom" | "top" | "left" | "right";
}

export default function Tooltip({
	children,
	content,
	position = "bottom",
}: TooltipProps) {
	const positionClasses: { [key: string]: string } = {
		bottom: "bottom-full mb-2",
		top: "top-full mt-2",
		left: "left-full ml-2",
		right: "right-full mr-2",
	};
	return (
		<div className="group relative flex items-center">
			{children}

			<div
				className={`${positionClasses[position]} dark:bg-electricIndigo absolute hidden w-max rounded-md  bg-black p-2 text-xs text-white opacity-0 group-hover:block group-hover:opacity-100`}
			>
				{content}
			</div>
		</div>
	);
}
