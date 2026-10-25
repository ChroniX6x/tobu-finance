// Only errors created by trusted runner code may be shown by the administrative CLI.
export class MigrationDiagnosticError extends Error {}

export function migrationErrorMessage(error: unknown): string {
    if (!(error instanceof MigrationDiagnosticError)) return 'Migration command failed. Check database connectivity and permissions; private driver details are suppressed.';
    const cause = error.cause instanceof MigrationDiagnosticError ? ` ${migrationErrorMessage(error.cause)}` : '';
    return error.message + cause;
}
