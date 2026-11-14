// Independent E07 examples, not generated from a schema or Mongo validator.
export function recurrenceActivityExamples({ recurrence, revision, previousRevision, previousRecurrence, previousOccurrence, transaction }) {
    return {
        'recurrence.created': { recurrenceId: recurrence, revisionId: revision, title: 'Vorlage' },
        'recurrence.config.updated': { recurrenceId: recurrence, revisionId: revision, previousRevisionId: previousRevision, changedFields: ['title', 'notes'] },
        'recurrence.activated': { recurrenceId: recurrence },
        'recurrence.deactivated': { recurrenceId: recurrence },
        'recurrence.revision.discarded': { recurrenceId: recurrence, revisionId: revision, restoredRevisionId: previousRevision },
        'recurrence.deleted': { recurrenceId: recurrence },
        'occurrence.generated': { recurrenceId: recurrence, revisionId: revision, occurrenceKey: '2026-11', transactionId: transaction },
        'occurrence.skipped': { recurrenceId: recurrence, occurrenceKey: '2026-11' },
        'occurrence.unskipped': { recurrenceId: recurrence, occurrenceKey: '2026-11', choice: 'release' },
        'occurrence.linked': { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction },
        'occurrence.reassigned': { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction, previousRecurrenceId: previousRecurrence, previousOccurrenceId: previousOccurrence, previousOccurrenceKey: '2026-10' },
        'occurrence.unlinked': { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction, choice: 'release' }
    };
}
