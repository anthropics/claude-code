import { HomeModernIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

type FormHeaderProps = {
	title?: string;
	staticText?: string;
	linkText?: string;
	linkHref?: string;
};

export default function AuthFormHeader({
	title,
	staticText,
	linkHref,
	linkText,
}: FormHeaderProps) {
	return (
		<div className="px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-6 lg:px-8">
			<HomeModernIcon className="mx-auto size-16 dark:text-lime-500" />
			<h2 className="text-baby_richBlack h2-bold font-robotoSlab dark:text-pumpkin mt-3 text-center">
				{title}
			</h2>
			{(staticText || linkText) && linkHref && (
				<p className="dark:text-platinum mt-4 text-center text-lg">
					{staticText && <span>{staticText}</span>}
					{linkText && (
						<Link
							href={linkHref}
							className="ml-1 font-semibold text-indigo-600 hover:text-indigo-500 dark:text-lime-500 dark:hover:text-indigo-500"
						>
							{linkText}
						</Link>
					)}
				</p>
			)}
		</div>
	);
}
