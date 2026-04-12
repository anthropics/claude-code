"use client";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useResetPasswordRequestMutation } from "@/lib/redux/features/auth/authApiSlice";
import { useForm } from "react-hook-form";
import {
	passwordResetRequestSchema,
	TPasswordResetRequestSchema,
} from "@/lib/validationSchemas";
import { extractErrorMessage } from "@/utils";
import { toast } from "react-toastify";
import { FormFieldComponent } from "@/components/forms/FormFieldComponent";
import { MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/shared/Spinner";

export default function PasswordResetRequestForm() {
	const [resetPasswordRequest, { isLoading }] =
		useResetPasswordRequestMutation();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<TPasswordResetRequestSchema>({
		resolver: zodResolver(passwordResetRequestSchema),
		mode: "all",
		defaultValues: {
			email: "",
		},
	});

	const onSubmit = async (
		values: z.infer<typeof passwordResetRequestSchema>,
	) => {
		try {
			await resetPasswordRequest(values).unwrap();
			toast.success("Request sent, check your email for the reset link");
			reset();
		} catch (e) {
			const errorMessage = extractErrorMessage(e);
			toast.error(errorMessage || "An error occurred");
		}
	};
	return (
		<main>
			<form
				noValidate
				onSubmit={handleSubmit(onSubmit)}
				className="flex w-full max-w-md flex-col gap-4"
			>
				<FormFieldComponent
					label="Email Address"
					name="email"
					register={register}
					errors={errors}
					placeholder="Email Address"
					startIcon={<MailIcon className="dark:text-babyPowder size-8" />}
				/>
				<Button
					type="submit"
					className="h4-semibold bg-eerieBlack dark:bg-pumpkin w-full text-white"
					disabled={isLoading}
				>
					{isLoading ? <Spinner size="sm" /> : `Request Password Reset`}
				</Button>
			</form>
		</main>
	);
}
