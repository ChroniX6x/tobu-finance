import type { Document, IndexDescription } from 'mongodb';
import type { structuralContext } from './structural-context.js';
import type { SchemaState, History } from './migration-state.js';

export type StructuralContext = ReturnType<typeof structuralContext>['context'];
export type CollectionSchema = { name: string; validator: Document; indexes: IndexDescription[] };
export interface StructuralStep {
    id: string;
    inspect(context: StructuralContext): Promise<'before' | 'after' | 'ambiguous'>;
    apply(context: StructuralContext): Promise<void>;
    verify(context: StructuralContext): Promise<void>;
}
export interface StructuralMigration {
    type: 'structural';
    predecessor: string;
    description: string;
    namespaces: string[];
    // Complete expected schema for each changed namespace; null means absent.
    schemaChanges: Record<string, CollectionSchema | null>;
    preUp(context: StructuralContext): Promise<void>;
    preDown(context: StructuralContext): Promise<void>;
    up: StructuralStep[];
    down: StructuralStep[];
    verifyUp(context: StructuralContext): Promise<void>;
    verifyDown(context: StructuralContext): Promise<void>;
}
export type StructuralRun = {
    _id: string;
    migration: string;
    checksum: string;
    direction: 'up' | 'down';
    targetHash: string;
    before: SchemaState;
    history: History[];
    stage: 'preparing' | 'backup-verified' | 'applying' | 'verifying' | 'succeeded' | 'restoring' | 'restored';
    steps: Record<string, 'started' | 'done'>;
};
