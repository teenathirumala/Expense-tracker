import { z } from "zod";

//email:Since both schemas use the same email rules, define const email = ... once and reuse it.
const email = z
  .string({ required_error: "Email is required", invalid_type_error: "Email must be text" })
  .trim()
  .email("Enter a valid email address")
  .toLowerCase();

export const registerBody = z.object({
   name: z
    .string({ required_error: "Name is required", invalid_type_error: "Name must be text" })
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(6, "Password must be at least 6 characters"),
});

export const loginBody = z.object({
   email,
  password: z
    .string({ required_error: "Password is required", invalid_type_error: "Password must be text" })
    .min(1, "Password is required"),
});