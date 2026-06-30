import mongoose from 'mongoose';

const popupSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    buttonText: {
      type: String,
      trim: true,
      default: '',
    },
    buttonUrl: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Popup = mongoose.model('Popup', popupSchema);
export default Popup;
