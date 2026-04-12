import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { setAuth, setLogout } from "@/lib/redux/features/auth/authSlice";
import {
	BaseQueryFn,
	FetchArgs,
	FetchBaseQueryError,
} from "@reduxjs/toolkit/query";

import { Mutex } from "async-mutex";

const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
	baseUrl: "/api/v1",
	credentials: "include",
});

const baseQueryWithReauth: BaseQueryFn<
	string | FetchArgs,
	unknown,
	FetchBaseQueryError
> = async (args, api, extraOptions) => {
	await mutex.waitForUnlock();

	let response = await baseQuery(args, api, extraOptions);

	if (response.error && response.error.status === 401) {
		if (!mutex.isLocked()) {
			const release = await mutex.acquire();
			try {
				const refreshResponse = await baseQuery(
					{
						url: "/auth/refresh/",
						method: "POST",
					},
					api,
					extraOptions,
				);

				if (refreshResponse?.data) {
					api.dispatch(setAuth());
					response = await baseQuery(args, api, extraOptions);
				} else {
					api.dispatch(setLogout());
				}
			} finally {
				release();
			}
		} else {
			await mutex.waitForUnlock();
			response = await baseQuery(args, api, extraOptions);
		}
	}
	return response;
};

export const baseApiSlice = createApi({
	reducerPath: "api",
	baseQuery: baseQueryWithReauth,
	tagTypes: ["User", "Apartment", "Issue", "Report", "Post"],
	refetchOnFocus: true,
	refetchOnMountOrArgChange: true,
	endpoints: (builder) => ({}),
});
