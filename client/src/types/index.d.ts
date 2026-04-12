export interface LeftNavLink {
	path: string;
	label: string;
	imgLocation: string;
}

export interface UserCommonData {
	email: string;
	password: string;
}

export interface User {
	first_name: string;
	last_name: string;
	email: string;
}

export interface UserResponse {
	id: string;
	email: string;
	first_name: string;
	last_name: string;
	username: string;
	slug: string;
	full_name: string;
	gender: string;
	occupation: string;
	phone_number: string;
	country: string;
	city: string;
	reputation: string;
	avatar: string;
	date_joined: string;
}
export interface RegisterUserData extends UserCommonData {
	username: string;
	first_name: string;
	last_name: string;
	re_password: string;
}

export interface LoginUserData extends UserCommonData {}

export interface ActivateUserData {
	uid: string;
	token: string;
}
export interface ResetPasswordConfirmData extends ActivateUserData {
	new_password: string;
	re_new_password: string;
}
export interface ResetPasswordData {
	email: string;
}

export interface RegisterUserResponse {
	id: string;
	username: string;
	first_name: string;
	last_name: string;
	email: string;
}
export interface LoginResponse {
	message: string;
}
export interface SocialAuthArgs {
	provider: string;
	state: string;
	code: string;
}
export interface SocialAuthResponse {
	message: string;
	user: User;
}
