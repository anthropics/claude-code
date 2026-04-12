"use client"
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoonIcon,SunIcon } from '@radix-ui/react-icons'
import { useTheme } from 'next-themes'
import React from 'react'

const themeOptions = [
    {value:"light",label:"Light"},
    {value:"dark",label:"Dark"},
    {value:"system",label:"System"},
]
export default function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				asChild
				className="cursor-pointer border-none bg-transparent shadow-none"
			>
				<Button size="icon">
					<SunIcon
						className={`size-[1.8rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 ${
							theme === "light" ? "text-pumpkin" : "text-gray-400"
						}`}
						suppressHydrationWarning
					/>
					<MoonIcon
						className={`absolute size-[1.8rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 ${
							theme === "light" ? "text-blue-400" : "text-gray-400"
						}`}
						suppressHydrationWarning
					/>
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="bg-babyPowder dark:bg-richBlack cursor-pointer rounded-md p-2"
			>
				{themeOptions.map(({ value, label }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => setTheme(value)}
						className={`hover:bg-richBlack dark:hover:bg-gray cursor-pointer ${theme === "light" && value === "light" ? "text-pumpkin" : theme === "dark" && value === "dark" ? "text-blue-400" : theme === "light" ? "text-richBlack hover:text-babyPowder" : "text-babyPowder"}`}
					>
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}