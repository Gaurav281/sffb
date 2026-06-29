import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import protect from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'battleplaysecretkey', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', async (req, res) => {
  const { name, username, email, phone, password } = req.body;

  try {
    if (!name || !username || !email || !phone || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const emailNormalized = email.toLowerCase().trim();
    const usernameNormalized = username.toLowerCase().trim();

    // Check if user email exists
    const emailExists = await User.findOne({ email: emailNormalized });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if username exists
    const usernameExists = await User.findOne({ username: usernameNormalized });
    if (usernameExists) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Create user. The first user ever created gets 'admin' role automatically for easier testing.
    const userCount = await User.countDocuments({});
    const role = userCount === 0 ? 'admin' : 'user';

    const user = await User.create({
      name,
      username: usernameNormalized,
      email: emailNormalized,
      phone,
      password,
      role,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body; // loginIdentifier can be username or email

  try {
    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Please enter login details' });
    }

    const identifierNormalized = loginIdentifier.toLowerCase().trim();

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { email: identifierNormalized },
        { username: identifierNormalized },
      ],
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
