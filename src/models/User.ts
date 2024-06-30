import { Schema, model } from 'mongoose';

const UserSchema = new Schema({
  socketId: { type: String, required: true, min: 4, unique: true },
  roomId: { type: String, required: true, min: 2 },
});

export const UserModel = model('User', UserSchema, 'Users');