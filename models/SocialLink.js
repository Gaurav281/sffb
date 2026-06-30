import mongoose from 'mongoose';

const socialLinkSchema = new mongoose.Schema(
  {
    platform: {
      type: String, // e.g. 'whatsapp', 'instagram', 'telegram'
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
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

const SocialLink = mongoose.model('SocialLink', socialLinkSchema);
export default SocialLink;
