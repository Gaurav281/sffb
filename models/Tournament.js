import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  username: {
    type: String,
    default: null,
  },
  ffName: {
    type: String,
    default: null,
  },
  ffUid: {
    type: String,
    default: null,
  },
});

const tournamentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['1v1', 'BR', 'CS'],
    },
    dateTime: {
      type: Date,
      required: true,
    },
    prizePool: {
      type: Number,
      required: true,
      default: 0,
    },
    perKill: {
      type: Number,
      required: true,
      default: 0,
    },
    entryFee: {
      type: Number,
      required: true,
      default: 0,
    },
    map: {
      type: String,
      required: true,
      default: 'Bermuda',
    },
    totalSlots: {
      type: Number,
      required: true,
    },
    slots: [slotSchema],
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed'],
      default: 'upcoming',
    },
    roomId: {
      type: String,
      default: '',
    },
    roomPassword: {
      type: String,
      default: '',
    },
    results: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        username: String,
        kills: {
          type: Number,
          default: 0,
        },
        prizeWon: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Tournament = mongoose.model('Tournament', tournamentSchema);

export default Tournament;
