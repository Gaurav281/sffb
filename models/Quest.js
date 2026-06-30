import mongoose from 'mongoose';

const questSchema = new mongoose.Schema(
  {
    key: {
      type: String, // e.g. 'cs', 'br', 'win'
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    prize: {
      type: Number,
      required: true,
    },
    target: {
      type: Number,
      required: true,
    },
    type: {
      type: String, // 'cs', 'br', 'win'
      required: true,
      enum: ['cs', 'br', 'win'],
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

const Quest = mongoose.model('Quest', questSchema);
export default Quest;
