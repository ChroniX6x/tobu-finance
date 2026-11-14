import mongoose, { Schema, type InferSchemaType, type Model, model } from 'mongoose';
import { ActivityWriteEventSchema } from '@tobu/contracts/activity';

const EventSchema = new Schema(
    {
        accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        date: { type: Date, required: true },
        code: { type: String, required: true },
        params: { type: Object, required: true, default: {} },
        createdByMemberId: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
        // No defaults/backfill: unversioned documents remain legacy, never guessed actors.
        schemaVersion: { type: Number },
        actor: { type: Schema.Types.Mixed },
        trigger: { type: Schema.Types.Mixed },
        subject: { type: Schema.Types.Mixed },
        commandId: { type: String },
        correlationId: { type: String },
        batchId: { type: String }
    },
    { timestamps: true, minimize: false }
);

EventSchema.index({ accountId: 1, date: -1 });
EventSchema.index({ accountId: 1, date: -1, _id: -1 }, { name: 'accountId_1_date_-1__id_-1' });

// The transition still permits old writers (E05); any claimed new envelope must satisfy E01.
EventSchema.pre('validate', function () {
    if (this.schemaVersion === undefined) return;
    const raw = this.toObject();
    const event = Object.fromEntries(Object.entries(raw).filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key)));
    ActivityWriteEventSchema.parse({ ...event, accountId: String(this.accountId) });
});

export type EventDoc = InferSchemaType<typeof EventSchema>;

// Cast guards against OverwriteModelError in hot-reload while keeping correct types.
const EventModel = (mongoose.models['Event'] as Model<EventDoc> | undefined) ?? model<EventDoc>('Event', EventSchema);
export default EventModel;
