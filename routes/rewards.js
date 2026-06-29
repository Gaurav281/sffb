import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Helper to get current IST date string (YYYY-MM-DD)
export const getISTDateString = () => {
  const d = new Date();
  // UTC + 5:30 for Indian Standard Time
  const istTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toISOString().split('T')[0];
};

// Check and reset rewards if date has changed
export const checkAndResetDailyRewards = (user) => {
  const todayStr = getISTDateString();
  if (user.dailyRewards.lastClaimedDate !== todayStr) {
    user.dailyRewards.lastClaimedDate = todayStr;
    user.dailyRewards.csPlayedCount = 0;
    user.dailyRewards.brPlayedCount = 0;
    user.dailyRewards.wonCount = 0;
    user.dailyRewards.csClaimed = false;
    user.dailyRewards.brClaimed = false;
    user.dailyRewards.winClaimed = false;
    return true; // was reset
  }
  return false;
};

// @desc    Get user's daily rewards status
// @route   GET /api/rewards
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const wasReset = checkAndResetDailyRewards(user);
    if (wasReset) {
      await user.save();
    }
    res.json(user.dailyRewards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Claim daily reward
// @route   POST /api/rewards/claim
// @access  Private
router.post('/claim', protect, async (req, res) => {
  const { rewardType } = req.body; // 'cs', 'br', or 'win'

  try {
    if (!['cs', 'br', 'win'].includes(rewardType)) {
      return res.status(400).json({ message: 'Invalid reward type' });
    }

    const user = await User.findById(req.user._id);
    checkAndResetDailyRewards(user);

    let amount = 0;
    let desc = '';

    if (rewardType === 'cs') {
      if (user.dailyRewards.csClaimed) {
        return res.status(400).json({ message: 'Reward already claimed today' });
      }
      if (user.dailyRewards.csPlayedCount < 10) {
        return res.status(400).json({ message: 'Requirement not met. Play 10 CS tournaments.' });
      }
      amount = 10;
      desc = 'Daily Reward: Play 10 CS Tournaments';
      user.dailyRewards.csClaimed = true;
    } else if (rewardType === 'br') {
      if (user.dailyRewards.brClaimed) {
        return res.status(400).json({ message: 'Reward already claimed today' });
      }
      if (user.dailyRewards.brPlayedCount < 5) {
        return res.status(400).json({ message: 'Requirement not met. Play 5 BR tournaments.' });
      }
      amount = 5;
      desc = 'Daily Reward: Play 5 BR Tournaments';
      user.dailyRewards.brClaimed = true;
    } else if (rewardType === 'win') {
      if (user.dailyRewards.winClaimed) {
        return res.status(400).json({ message: 'Reward already claimed today' });
      }
      if (user.dailyRewards.wonCount < 1) {
        return res.status(400).json({ message: 'Requirement not met. Win 1 tournament.' });
      }
      amount = 15;
      desc = 'Daily Reward: Win 1 Tournament';
      user.dailyRewards.winClaimed = true;
    }

    // Add reward to winning balance
    user.wallet.winning += amount;
    await user.save();

    // Create completed transaction history
    await Transaction.create({
      user: user._id,
      type: 'reward_win',
      amount,
      status: 'completed',
      description: desc,
    });

    res.json({
      message: `Successfully claimed Rs ${amount} reward!`,
      dailyRewards: user.dailyRewards,
      wallet: user.wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
