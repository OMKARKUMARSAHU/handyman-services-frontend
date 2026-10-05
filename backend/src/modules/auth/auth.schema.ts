import { z } from "zod";

/**
 * Mirrors the REAL Cognito User Pool password policy (verified via the AWS
 * MCP connector during this phase's INSPECT/PLAN steps — not invented):
 * minimum length 8, at least one uppercase, one lowercase, one number, one
 * symbol. Validating this shape here is purely a better error message for
 * the caller; Cognito enforces the real policy itself regardless.
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[0-9]/, "Password must contain a number.")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol.");

const emailSchema = z.string().trim().toLowerCase().email("A valid email address is required.");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  email: emailSchema,
  password: passwordSchema,
});

export const confirmSignupSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "The verification code is required."),
});

export const resendCodeSchema = z.object({
  email: emailSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

/** Completes an in-progress Cognito NEW_PASSWORD_REQUIRED challenge (Admin/Provider first login after AdminCreateUser). */
export const completeNewPasswordSchema = z.object({
  email: emailSchema,
  session: z.string().min(1, "The authentication session is required."),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const confirmForgotPasswordSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, "The verification code is required."),
  newPassword: passwordSchema,
});

/**
 * Service Provider self-registration (FINAL AUTHENTICATION ARCHITECTURE §5)
 * — marketplace onboarding fields, reused as-is by
 * `createProviderApplication` once SignUp succeeds. `forgotPasswordSchema`/
 * `confirmForgotPasswordSchema`/`confirmSignupSchema`/`resendCodeSchema`
 * above are reused verbatim for the Provider and shared Admin/Provider
 * endpoints too — their shapes are identical, so no separate schema exists
 * for those (avoiding duplicate validation logic for an identical shape).
 */
export const providerSignupSchema = z.object({
  name: z.string().trim().min(1, "Full name is required.").max(150),
  email: emailSchema,
  phone: z.string().trim().min(6, "A valid mobile number is required.").max(20),
  password: passwordSchema,
  businessName: z.string().trim().max(150).optional(),
  city: z.string().trim().min(1, "City is required.").max(100),
  categories: z.array(z.string().trim().min(1)).min(1, "Select at least one service category."),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  bio: z.string().trim().max(1000).optional(),
  availability: z.string().trim().max(150).optional(),
  termsAccepted: z.boolean().refine((v) => v === true, { message: "You must accept the Terms & Conditions." }),
  privacyAccepted: z.boolean().refine((v) => v === true, { message: "You must accept the Privacy Policy." }),
});
