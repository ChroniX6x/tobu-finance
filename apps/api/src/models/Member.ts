import mongoose, { Schema, type InferSchemaType, type Model, model } from 'mongoose';

const MemberSchema = new Schema(
    {
        name: { type: String, default: null },
        email: { type: String, default: null },
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', select: false },
        avatar: { type: String, default: null } // NEU
    },
    { timestamps: true }
);
MemberSchema.index({ userId: 1 }, { name: 'userId_1' });

export type MemberDoc = InferSchemaType<typeof MemberSchema>;
export default (mongoose.models['Member'] as Model<MemberDoc> | undefined) ?? model<MemberDoc>('Member', MemberSchema);
