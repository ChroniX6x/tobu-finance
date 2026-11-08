// Independent E07 contract examples. These describe generic fixture records, not implemented recurrence models.
export function recurrenceActivitySamples(ids) {
    const { recurrence, revision, previousRevision, occurrence, previousRecurrence, previousOccurrence, transaction } = ids;
    return {
        'recurrence.created': ['recurrence', recurrence, { recurrenceId: recurrence, revisionId: revision, title: 'Platform fixture' }],
        'recurrence.config.updated': ['recurrence', recurrence, { recurrenceId: recurrence, revisionId: revision, previousRevisionId: previousRevision, changedFields: ['title', 'notes'] }],
        'recurrence.activated': ['recurrence', recurrence, { recurrenceId: recurrence }],
        'recurrence.deactivated': ['recurrence', recurrence, { recurrenceId: recurrence }],
        'recurrence.revision.discarded': ['recurrence', recurrence, { recurrenceId: recurrence, revisionId: revision, restoredRevisionId: previousRevision }],
        'recurrence.deleted': ['recurrence', recurrence, { recurrenceId: recurrence }],
        'occurrence.generated': ['occurrence', occurrence, { recurrenceId: recurrence, revisionId: revision, occurrenceKey: '2026-11', transactionId: transaction }],
        'occurrence.skipped': ['occurrence', occurrence, { recurrenceId: recurrence, occurrenceKey: '2026-11' }],
        'occurrence.unskipped': ['occurrence', occurrence, { recurrenceId: recurrence, occurrenceKey: '2026-11', choice: 'release' }],
        'occurrence.linked': ['occurrence', occurrence, { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction }],
        'occurrence.reassigned': [
            'occurrence',
            occurrence,
            { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction, previousRecurrenceId: previousRecurrence, previousOccurrenceId: previousOccurrence, previousOccurrenceKey: '2026-10' }
        ],
        'occurrence.unlinked': ['occurrence', occurrence, { recurrenceId: recurrence, occurrenceKey: '2026-11', transactionId: transaction, choice: 'release' }]
    };
}
