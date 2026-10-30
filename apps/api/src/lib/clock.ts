/**
 * Server clock. Production always uses the real time. Only a test run (NODE_ENV=test) may freeze it with
 * TOBU_TEST_NOW (ISO instant) so that month boundaries can be tested deterministically; the variable is ignored otherwise.
 */
export function now(): Date {
    const frozen = process.env.NODE_ENV === 'test' ? process.env.TOBU_TEST_NOW : undefined;
    if (frozen) {
        const date = new Date(frozen);
        if (Number.isNaN(date.getTime())) throw new Error('TOBU_TEST_NOW is not a valid ISO instant');
        return date;
    }
    return new Date();
}
