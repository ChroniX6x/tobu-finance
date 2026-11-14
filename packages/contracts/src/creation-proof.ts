import { z } from 'zod';

/** Server-issued domain creation proof. This header never accepts event ids, actors or commands. */
export const CREATION_PROOF_HEADER = 'X-Tobu-Creation';
export const CreationProofSchema = z
    .string()
    .min(64)
    .max(2048)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
export const CreationProofRequiredSchema = z.strictObject({ error: z.literal('CREATION_PROOF_REQUIRED'), creationProof: CreationProofSchema });
export const usesCreationProof = (method: string, path: string) => method.toUpperCase() === 'POST' && /^\/api\/(accounts|members|transactions|categories|member-incomes|category-budgets|contribution-rules|recurrences)\/?$/.test(path);
export const MUTATION_PROOF_HEADER = 'X-Tobu-Mutation';
export const MutationProofRequiredSchema = z.strictObject({ error: z.literal('MUTATION_PROOF_REQUIRED'), mutationProof: CreationProofSchema });
export const usesMutationProof = (method: string, path: string) =>
    (['PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase()) && /^\/api\/(accounts|members|transactions|categories|member-incomes|category-budgets|contribution-rules|carryovers|account-balances|recurrences)(\/|$)/.test(path)) ||
    (method.toUpperCase() === 'POST' && /^\/api\/accounts\/[^/]+\/members\/?$/.test(path));
