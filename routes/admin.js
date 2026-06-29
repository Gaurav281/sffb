import express from 'express';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Transaction from '../models/Transaction.js';
import Announcement from '../models/Announcement.js';
import protect from '../middleware/auth.js';
import admin from '../middleware/admin.js';
import { checkAndResetDailyRewards } from './rewards.js';

const router = express.Router();

// Apply admin protection middleware to all routes in this router
router.use(protect);
router.use(admin);

// @desc    Get all transactions (for review)
// @route   GET /api/admin/transactions
// @access  Private/Admin
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('user', 'name username email phone')
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Approve a deposit
// @route   PUT /api/admin/deposit/:id/approve
// @access  Private/Admin
router.put('/deposit/:id/approve', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.type !== 'deposit') {
      return res.status(404).json({ message: 'Deposit transaction not found' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction is already processed' });
    }

    const user = await User.findById(txn.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Approve transaction
    txn.status = 'approved';
    txn.description = 'Deposited Money (Approved by Admin)';
    await txn.save();

    // Increment user's deposited wallet
    user.wallet.deposited += txn.amount;
    await user.save();

    res.json({ message: 'Deposit approved successfully', transaction: txn });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Reject a deposit
// @route   PUT /api/admin/deposit/:id/reject
// @access  Private/Admin
router.put('/deposit/:id/reject', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.type !== 'deposit') {
      return res.status(404).json({ message: 'Deposit transaction not found' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction is already processed' });
    }

    // Reject transaction
    txn.status = 'rejected';
    txn.description = 'Deposited Money (Rejected by Admin)';
    await txn.save();

    res.json({ message: 'Deposit rejected successfully', transaction: txn });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Approve a withdrawal
// @route   PUT /api/admin/withdraw/:id/approve
// @access  Private/Admin
router.put('/withdraw/:id/approve', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.type !== 'withdraw') {
      return res.status(404).json({ message: 'Withdrawal transaction not found' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction is already processed' });
    }

    // Complete transaction
    txn.status = 'approved';
    txn.description = 'Withdrawal Complete (Sent by Admin)';
    await txn.save();

    res.json({ message: 'Withdrawal approved successfully', transaction: txn });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Reject a withdrawal (refund winning balance)
// @route   PUT /api/admin/withdraw/:id/reject
// @access  Private/Admin
router.put('/withdraw/:id/reject', async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn || txn.type !== 'withdraw') {
      return res.status(404).json({ message: 'Withdrawal transaction not found' });
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction is already processed' });
    }

    const user = await User.findById(txn.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Reject transaction
    txn.status = 'rejected';
    txn.description = 'Withdrawal Rejected (Refunded to Winnings)';
    await txn.save();

    // Refund user winnings balance
    user.wallet.winning += txn.amount;
    await user.save();

    res.json({ message: 'Withdrawal rejected and refunded successfully', transaction: txn });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Create a tournament
// @route   POST /api/admin/tournament
// @access  Private/Admin
router.post('/tournament', async (req, res) => {
  const { title, type, dateTime, prizePool, perKill, entryFee, map, totalSlots, roomId, roomPassword } = req.body;

  try {
    if (!title || !type || !dateTime || !totalSlots) {
      return res.status(400).json({ message: 'Please provide all required tournament fields' });
    }

    // Initialize slots array dynamically based on totalSlots
    const slots = [];
    for (let i = 1; i <= Number(totalSlots); i++) {
      slots.push({ number: i, user: null, username: null, ffName: null, ffUid: null });
    }

    const tournament = await Tournament.create({
      title,
      type,
      dateTime,
      prizePool: Number(prizePool) || 0,
      perKill: Number(perKill) || 0,
      entryFee: Number(entryFee) || 0,
      map: map || 'Bermuda',
      totalSlots: Number(totalSlots),
      slots,
      status: 'upcoming',
      roomId: roomId || '',
      roomPassword: roomPassword || '',
    });

    res.status(201).json({ message: 'Tournament created successfully', tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update a tournament
// @route   PUT /api/admin/tournament/:id
// @access  Private/Admin
router.put('/tournament/:id', async (req, res) => {
  const { title, type, dateTime, prizePool, perKill, entryFee, map, totalSlots, status, roomId, roomPassword } = req.body;

  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (title !== undefined) tournament.title = title;
    if (type !== undefined) tournament.type = type;
    if (dateTime !== undefined) tournament.dateTime = dateTime;
    if (prizePool !== undefined) tournament.prizePool = Number(prizePool) || 0;
    if (perKill !== undefined) tournament.perKill = Number(perKill) || 0;
    if (entryFee !== undefined) tournament.entryFee = Number(entryFee) || 0;
    if (map !== undefined) tournament.map = map;
    if (status !== undefined) tournament.status = status;
    if (roomId !== undefined) tournament.roomId = roomId;
    if (roomPassword !== undefined) tournament.roomPassword = roomPassword;

    // Handle slots resize if totalSlots changes and no users have booked yet
    if (totalSlots !== undefined && Number(totalSlots) !== tournament.totalSlots) {
      const bookedCount = tournament.slots.filter(s => s.user !== null).length;
      if (bookedCount > 0) {
        return res.status(400).json({ message: 'Cannot change total slots because players have already registered' });
      }
      const slots = [];
      for (let i = 1; i <= Number(totalSlots); i++) {
        slots.push({ number: i, user: null, username: null, ffName: null, ffUid: null });
      }
      tournament.slots = slots;
      tournament.totalSlots = Number(totalSlots);
    }

    await tournament.save();
    res.json({ message: 'Tournament updated successfully', tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Delete a tournament (with refunds)
// @route   DELETE /api/admin/tournament/:id
// @access  Private/Admin
router.delete('/tournament/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Refund registered players if the match was upcoming and entryFee > 0
    if (tournament.status === 'upcoming' && tournament.entryFee > 0) {
      for (const slot of tournament.slots) {
        if (slot.user) {
          const user = await User.findById(slot.user);
          if (user) {
            user.wallet.deposited += tournament.entryFee;
            await user.save();

            await Transaction.create({
              user: user._id,
              type: 'refund',
              amount: tournament.entryFee,
              status: 'completed',
              description: `Refund for cancelled tournament: ${tournament.title}`,
            });
          }
        }
      }
    }

    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tournament deleted and refunds processed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get registered players for a tournament
// @route   GET /api/admin/tournament/:id/players
// @access  Private/Admin
router.get('/tournament/:id/players', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('slots.user', 'name username phone email');
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const registrations = tournament.slots
      .filter(s => s.user !== null)
      .map(s => ({
        slotNumber: s.number,
        userId: s.user ? s.user._id : null,
        name: s.user ? s.user.name : '',
        username: s.username,
        ffName: s.ffName,
        ffUid: s.ffUid,
        email: s.user ? s.user.email : '',
        phone: s.user ? s.user.phone : '',
      }));

    res.json(registrations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Change tournament status (e.g. upcoming -> ongoing)
// @route   PUT /api/admin/tournament/:id/status
// @access  Private/Admin
router.put('/tournament/:id/status', async (req, res) => {
  const { status } = req.body; // 'upcoming', 'ongoing', or 'completed'
  
  try {
    if (!['upcoming', 'ongoing', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    tournament.status = status;
    await tournament.save();

    res.json({ message: `Tournament status updated to ${status}`, tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Complete a tournament and distribute winnings
// @route   PUT /api/admin/tournament/:id/complete
// @access  Private/Admin
router.put('/tournament/:id/complete', async (req, res) => {
  const { playerResults } = req.body; 
  // playerResults is an array: [{ username: String, kills: Number, prizeWon: Number }]
  
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    if (tournament.status === 'completed') {
      return res.status(400).json({ message: 'Tournament is already completed' });
    }

    // Set status
    tournament.status = 'completed';
    
    // Save results on tournament
    const processedResults = [];
    const resultsMap = new Map(); // username -> { kills, prizeWon }
    
    if (playerResults && Array.isArray(playerResults)) {
      playerResults.forEach(resItem => {
        resultsMap.set(resItem.username.toLowerCase().trim(), {
          kills: Number(resItem.kills) || 0,
          prizeWon: Number(resItem.prizeWon) || 0
        });
      });
    }

    // Loop through participants (users in slots) to distribute earnings and update daily stats
    for (const slot of tournament.slots) {
      if (slot.user) {
        const user = await User.findById(slot.user);
        if (user) {
          // Reset daily rewards if date has changed
          checkAndResetDailyRewards(user);

          // Update game count played
          if (tournament.type === 'CS') {
            user.dailyRewards.csPlayedCount += 1;
          } else if (tournament.type === 'BR') {
            user.dailyRewards.brPlayedCount += 1;
          }

          // Fetch result details from admin inputs
          const userResult = resultsMap.get(user.username.toLowerCase().trim());
          const kills = userResult ? userResult.kills : 0;
          const prizeWon = userResult ? userResult.prizeWon : 0;
          const killEarnings = kills * tournament.perKill;
          const totalWinnings = prizeWon + killEarnings;

          // If won prize, increment daily winCount
          if (prizeWon > 0) {
            user.dailyRewards.wonCount += 1;
          }

          if (totalWinnings > 0) {
            user.wallet.winning += totalWinnings;
            
            // Create Transaction record
            await Transaction.create({
              user: user._id,
              type: 'winnings',
              amount: totalWinnings,
              status: 'completed',
              description: `Earnings from ${tournament.title}: Kill count (${kills} x Rs ${tournament.perKill}) + Rank Prize (Rs ${prizeWon})`,
            });
          }

          await user.save();

          processedResults.push({
            user: user._id,
            username: user.username,
            kills,
            prizeWon
          });
        }
      }
    }

    tournament.results = processedResults;
    await tournament.save();

    res.json({ message: 'Tournament completed and rewards distributed successfully', tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Add announcement
// @route   POST /api/admin/announcement
// @access  Private/Admin
router.post('/announcement', async (req, res) => {
  const { text } = req.body;
  try {
    if (!text) {
      return res.status(400).json({ message: 'Announcement text is required' });
    }
    const announcement = await Announcement.create({ text });
    res.status(201).json(announcement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Deactivate announcements
// @route   PUT /api/admin/announcement/:id
// @access  Private/Admin
router.put('/announcement/:id', async (req, res) => {
  const { isActive } = req.body;
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    announcement.isActive = isActive;
    await announcement.save();
    res.json(announcement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get user leaderboard
// @route   GET /api/admin/users/leaderboard
// @access  Private/Admin
// Wait, leaderboard is needed by everyone, let's keep it here or register in user routes
router.get('/users/leaderboard', async (req, res) => {
  try {
    // Rank users based on aggregate winnings (using wallet.winning or sum of winnings transactions)
    // For simplicity, we can fetch all users sorted by winnings balance or aggregated winnings transaction.
    // Let's sort by wallet.winning + wallet.deposited (or we can rank by wallet.winning)
    const users = await User.find().select('name username wallet').sort({ 'wallet.winning': -1 }).limit(10);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
