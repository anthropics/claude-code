import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState = {
	searchTerm: "",
	page: 1,
};

const userSlice = createSlice({
	name: "user",
	initialState,
	reducers: {
		setSearchTerm: (state, action: PayloadAction<string>) => {
			state.searchTerm = action.payload;
		},
		setCurrentPage: (state, action: PayloadAction<number>) => {
			state.page = action.payload;
		},
	},
});

export const { setSearchTerm, setCurrentPage } = userSlice.actions;
export default userSlice.reducer;
