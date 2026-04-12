"use client";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";
import { useState } from "react";

export interface PasswordInputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
	({ className, ...props }, ref) => {
		const [showPassword, setShowPassword] = useState(false);
		return (
			<>
				<Input
					type={showPassword ? "text" : "password"}
					endIcon={
						showPassword ? (
							<EyeIcon
								onClick={() => setShowPassword(false)}
								className="size-8 select-none dark:text-babyPowder"
							/>
						) : (
							<EyeOffIcon
								onClick={() => setShowPassword(true)}
								className="size-8 select-none dark:text-babyPowder"
							/>
						)
					}
					className={className}
					{...props}
					ref={ref}
				/>
			</>
		);
	},
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
