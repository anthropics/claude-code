import clsx from "clsx";
import { useTheme } from "next-themes";
import Image from "next/image";

interface SpinnerProps {
	size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
	sm: "size-10",
	md: "size-20",
	lg: "size-32",
	xl: "size-52",
};

export default function Spinner({ size = "md" }: SpinnerProps) {
	const { theme } = useTheme();
	const className = clsx("animate-spin", sizeClasses[size]);

	const dimensionMap = {
		sm: 40,
		md: 80,
		lg: 128,
		xl: 208,
	};

	const widthHeight = dimensionMap[size];

	const spinnerSrc =
		theme === "dark"
			? "/assets/icons/loading-dark.svg"
			: "/assets/icons/loading-light.svg";

	return (
		<div role="status">
			<Image
				className={className}
				src={spinnerSrc}
				alt="Loading..."
				width={widthHeight}
				height={widthHeight}
			/>
			<span className="sr-only">Loading...</span>
		</div>
	);
}
