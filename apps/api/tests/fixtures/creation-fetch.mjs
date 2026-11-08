/** Real HTTP client negotiation for existing suites. No mocked responses or catch-all success. */
export async function creationFetch(input, init) {
    const response = await globalThis.fetch(input, init);
    if (response.status !== 428) return response;
    const challenge = await response.clone().json();
    const mutation = challenge.error === 'MUTATION_PROOF_REQUIRED';
    const proof = mutation ? challenge.mutationProof : challenge.creationProof;
    if ((!mutation && challenge.error !== 'CREATION_PROOF_REQUIRED') || typeof proof !== 'string') return response;
    const header = mutation ? 'X-Tobu-Mutation' : 'X-Tobu-Creation';
    const headers = new globalThis.Headers(init?.headers);
    if (headers.has(header)) return response; // Never loop on a rejected supplied proof.
    headers.set(header, proof);
    return globalThis.fetch(input, { ...init, headers });
}
