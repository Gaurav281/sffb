import express from 'express';
import User from '../models/User.js';
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

export default router;
