import { z } from "zod";
export const registerSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(64).optional(),
    password: z.string().min(8).max(128),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
});
export const UserSchema = z.object({ id: z.string(), email: z.string(), name: z.string().optional(), roles: z.array(z.string()) });
export const AuthResponseSchema = z.object({ accessToken: z.string(), user: UserSchema });
export const RefreshResponseSchema = z.object({ accessToken: z.string() });
export type User = z.infer<typeof UserSchema>;
export type LoginCredentials = z.input<typeof loginSchema>;
export type RegisterData = z.input<typeof registerSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
