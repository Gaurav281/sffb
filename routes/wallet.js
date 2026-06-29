import express from 'express';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// @desc    Get user's transaction history
// @route   GET /api/wallet/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const history = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Request a deposit (add balance)
// @route   POST /api/wallet/deposit
// @access  Private
router.post('/deposit', protect, async (req, res) => {
  const { amount, upiTxnId } = req.body;

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid deposit amount' });
    }
    if (!upiTxnId || upiTxnId.trim() === '') {
      return res.status(400).json({ message: 'Please enter the UPI Transaction ID' });
    }

    // Check if UPI Transaction ID is already submitted
    const txnExists = await Transaction.findOne({ upiTxnId: upiTxnId.trim() });
    if (txnExists) {
      return res.status(400).json({ message: 'This UPI Transaction ID has already been submitted' });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'deposit',
      amount,
      status: 'pending',
      upiTxnId: upiTxnId.trim(),
      description: 'Deposited Money (Pending Admin Approval)',
    });

    res.status(201).json({
      message: 'Deposit request submitted successfully. Waiting for admin approval.',
      transaction,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Request a withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
router.post('/withdraw', protect, async (req, res) => {
  const { amount, upiId, phone } = req.body;

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid withdrawal amount' });
    }
    if (!upiId && !phone) {
      return res.status(400).json({ message: 'Please enter a UPI ID or Phone Number for receiving payment' });
    }

    const user = await User.findById(req.user._id);

    // Only winning balance can be withdrawn
    if (user.wallet.winning < amount) {
      return res.status(400).json({ message: 'Insufficient winning balance for withdrawal' });
    }

    // Atomically deduct withdrawal amount from user's winnings to prevent double withdrawals
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, 'wallet.winning': { $gte: amount } },
      { $inc: { 'wallet.winning': -amount } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ message: 'Double withdrawal attempt or concurrency error.' });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      type: 'withdraw',
      amount,
      status: 'pending',
      upiId: upiId || null,
      phone: phone || null,
      description: 'Withdrawal Request (Pending Admin Payout)',
    });

    res.status(201).json({
      message: 'Withdrawal request submitted successfully. Winnings deducted and pending payout.',
      transaction,
      wallet: updatedUser.wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
