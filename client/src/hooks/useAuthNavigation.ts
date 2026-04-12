import { leftNavLinks } from "@/constants";
import { useLogoutUserMutation } from "@/lib/redux/features/auth/authApiSlice";
import { setLogout } from "@/lib/redux/features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks/typedHooks";
import { extractErrorMessage } from "@/utils";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export function useAuthNavigation() {
	const dispatch = useAppDispatch();
	const [logoutUser] = useLogoutUserMutation();
	const { isAuthenticated } = useAppSelector((state) => state.auth);
	const router = useRouter();

	const handleLogout = async () => {
		try {
			await logoutUser().unwrap();
			dispatch(setLogout());
			router.push("/login");
			toast.success("Logged Out!");
		} catch (e) {
			const errorMessage = extractErrorMessage(e);
			toast.error(errorMessage || "An error occurred");
		}
	};

	const filteredNavLinks = leftNavLinks.filter((link) => {
		if (
			link.path === "/profile" ||
			link.path === "/tenants" ||
			link.path === "/bookmark" ||
			link.path === "/report-issue" ||
			link.path === "/report-tenant" ||
			link.path === "/technicians" ||
			link.path === "/add_post"
		) {
			return isAuthenticated;
		}
		return true;
	});

	return { handleLogout, filteredNavLinks, isAuthenticated };
}
