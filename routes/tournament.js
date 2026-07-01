import express from 'express';
import Tournament from '../models/Tournament.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Announcement from '../models/Announcement.js';
import SocialLink from '../models/SocialLink.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Helper to automatically change status of upcoming tournaments to ongoing if time has passed
const updateTournamentStatuses = async () => {
  try {
    const now = new Date();
    await Tournament.updateMany(
      { status: 'upcoming', dateTime: { $lte: now } },
      { $set: { status: 'ongoing' } }
    );
  } catch (err) {
    console.error('Error updating tournament statuses:', err);
  }
};

// @desc    Get all tournaments
// @route   GET /api/tournament
// @access  Public
router.get('/', async (req, res) => {
  const { type, status } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;

  try {
    await updateTournamentStatuses();
    const tournaments = await Tournament.find(filter)
      .select('title type dateTime prizePool perKill entryFee map totalSlots status slots.user slots.number createdAt')
      .sort({ dateTime: 1 });
    res.json(tournaments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get announcements
// @route   GET /api/tournament/announcements
// @access  Public
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get tournaments joined by current user
// @route   GET /api/tournament/my
// @access  Private
router.get('/my', protect, async (req, res) => {
  const { status } = req.query; // Filter by status: upcoming, ongoing, completed

  try {
    await updateTournamentStatuses();
    const filter = { "slots.user": req.user._id };
    if (status) {
      filter.status = status;
    }
    const tournaments = await Tournament.find(filter)
      .select('title type dateTime prizePool perKill entryFee map totalSlots status slots.user slots.number createdAt')
      .sort({ dateTime: 1 });
    res.json(tournaments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Seed default social links if empty
const seedDefaultSocialLinks = async () => {
  try {
    // Drop the unique constraint index in MongoDB to enable duplicate platform link storage
    await SocialLink.collection.dropIndex('platform_1').catch(() => {});
    const count = await SocialLink.countDocuments();
    if (count === 0) {
      await SocialLink.create([
        {
          platform: 'whatsapp',
          displayName: 'WhatsApp Group',
          url: 'https://wa.me/+919558782754',
          isActive: true,
        },
        {
          platform: 'instagram',
          displayName: 'Instagram Profile',
          url: 'https://instagram.com/',
          isActive: true,
        },
        {
          platform: 'telegram',
          displayName: 'Telegram Channel',
          url: 'https://t.me/battleplay_bot',
          isActive: true,
        }
      ]);
    }
  } catch (err) {
    console.error('Error seeding social links:', err);
  }
};

// @desc    Get active social media links
// @route   GET /api/tournament/social-links
// @access  Public
router.get('/social-links', async (req, res) => {
  try {
    await seedDefaultSocialLinks();
    const links = await SocialLink.find({ isActive: true });
    res.json(links);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get tournament details
// @route   GET /api/tournament/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    await updateTournamentStatuses();
    const tournament = await Tournament.findById(req.id || req.params.id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    res.json(tournament);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Join a tournament slot
// @route   POST /api/tournament/:id/join
// @access  Private
router.post('/:id/join', protect, async (req, res) => {
  const tournamentId = req.params.id;
  const { slotNumber, ffName, ffUid } = req.body;

  try {
    if (!slotNumber) {
      return res.status(400).json({ message: 'Please specify a slot number' });
    }
    if (!ffName || !ffUid) {
      return res.status(400).json({ message: 'Free Fire nickname and Character UID are required' });
    }

    await updateTournamentStatuses();
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournament.status !== 'upcoming' || new Date(tournament.dateTime) <= new Date()) {
      return res.status(400).json({ message: 'Tournament has already started or completed' });
    }

    // Check if user has already joined this tournament
    const alreadyJoined = tournament.slots.some(
      (slot) => slot.user && slot.user.toString() === req.user._id.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({ message: 'You have already joined this tournament' });
    }

    // Verify slot validity
    const slot = tournament.slots.find((s) => s.number === Number(slotNumber));
    if (!slot) {
      return res.status(400).json({ message: 'Invalid slot selection' });
    }
    if (slot.user !== null) {
      return res.status(400).json({ message: 'This slot is already booked' });
    }

    // Retrieve user and check balance
    const user = await User.findById(req.user._id);

    if (!user.ffName || !user.ffUid) {
      user.ffName = ffName.trim();
      user.ffUid = ffUid.trim();
      await user.save();
    }

    const totalBalance = user.wallet.deposited + user.wallet.winning;
    const entryFee = tournament.entryFee;

    if (totalBalance < entryFee) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // ATOMIC RESERVATION - Double booking safety
    // Find the tournament and update the slot only if that slot user is still null
    const updatedTournament = await Tournament.findOneAndUpdate(
      {
        _id: tournamentId,
        status: 'upcoming',
        'slots.number': slotNumber,
        'slots.user': null,
      },
      {
        $set: {
          'slots.$.user': req.user._id,
          'slots.$.username': req.user.username,
          'slots.$.ffName': ffName.trim(),
          'slots.$.ffUid': ffUid.trim(),
        },
      },
      { new: true }
    );

    if (!updatedTournament) {
      return res.status(400).json({ message: 'Slot booking failed. The slot may have just been taken.' });
    }

    // Deduct entry fee atomically from user's account
    let dedDeposited = 0;
    let dedWinning = 0;
    if (user.wallet.deposited >= entryFee) {
      dedDeposited = entryFee;
    } else {
      dedDeposited = user.wallet.deposited;
      dedWinning = entryFee - dedDeposited;
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        'wallet.deposited': { $gte: dedDeposited },
        'wallet.winning': { $gte: dedWinning },
      },
      {
        $inc: {
          'wallet.deposited': -dedDeposited,
          'wallet.winning': -dedWinning,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      // Revert tournament slot reservation if user balance update failed (due to concurrency)
      await Tournament.findOneAndUpdate(
        { _id: tournamentId, 'slots.number': slotNumber },
        { $set: { 'slots.$.user': null, 'slots.$.username': null, 'slots.$.ffName': null, 'slots.$.ffUid': null } }
      );
      return res.status(400).json({ message: 'Concurrency error during balance deduction. Please try again.' });
    }

    // Create a transaction log
    await Transaction.create({
      user: req.user._id,
      type: 'entry_fee',
      amount: entryFee,
      status: 'completed',
      description: `Entry Fee for ${tournament.title} (Slot #${slotNumber})`,
    });

    res.json({
      message: 'Joined tournament successfully',
      tournament: updatedTournament,
      wallet: updatedUser.wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
