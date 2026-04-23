// eslint-disable-next-line camelcase
import { Open_Sans, Roboto_Slab } from "next/font/google";

export const openSans = Open_Sans({
	subsets: ["latin"],
	variable: "--font-openSans",
});

export const robotoSlab = Roboto_Slab({
	subsets: ["latin"],
	variable: "--font-robotoSlab",
});
