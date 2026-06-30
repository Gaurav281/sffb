import express from 'express';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Popup from '../models/Popup.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// @desc    Get leaderboard standings (accessible to all authenticated users)
// @route   GET /api/user/leaderboard
// @access  Private
router.get('/leaderboard', protect, async (req, res) => {
  try {
    // Sort users by winnings balance to show top players
    const standings = await User.find({})
      .select('name username wallet.winning')
      .sort({ 'wallet.winning': -1 })
      .limit(50); // limit to top 50 players

    res.json(standings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get public notification history
// @route   GET /api/user/notifications
// @access  Private
router.get('/notifications', protect, async (req, res) => {
  try {
    const list = await Notification.find().sort({ createdAt: -1 }).limit(30);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get current active startup popup
// @route   GET /api/user/popup/active
// @access  Private
router.get('/popup/active', protect, async (req, res) => {
  try {
    const active = await Popup.findOne({ isActive: true }).sort({ createdAt: -1 });
    res.json(active || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
