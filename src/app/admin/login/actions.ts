"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          if ((error as AuthError & { code?: string }).code === "rate_limited") {
            return "Too many sign-in attempts. Please wait 15 minutes and try again.";
          }
          return "Invalid email or password.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}
