const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/error');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  })
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { firstName, lastName, email, password, phone, location, bio, skills, experience } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    location,
    bio,
    skills: skills ? skills.split(',').map(skill => skill.trim()) : [],
    experience
  });

  // Generate email verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save();

  // Send verification email
  const emailSent = await sendVerificationEmail(email, firstName, verificationToken);

  // Remove password from response
  user.password = undefined;

  res.status(201).json({
    success: true,
    message: emailSent 
      ? 'User registered successfully! Please check your email to verify your account.' 
      : 'User registered successfully! Please check your email to verify your account. (Email service temporarily unavailable)',
    data: {
      user,
      requiresVerification: true
    }
  });
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Check if user exists and password is correct
  const user = await User.findByEmail(email).select('+password');
  if (!user || !(await user.correctPassword(password, user.password))) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 401);
  }

  // Check if email is verified
  if (!user.emailVerified) {
    throw new AppError('Please verify your email address before logging in. Check your inbox for a verification link.', 401);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id);

  // Remove password from response
  user.password = undefined;

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      token
    }
  });
}));

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('jobCount');
  
  res.json({
    success: true,
    data: {
      user
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('skills').optional().isArray(),
  body('experience').optional().isIn(['entry', 'junior', 'mid', 'senior', 'lead', 'executive'])
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
}));

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  })
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  if (!(await user.correctPassword(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// @desc    Verify email
// @route   GET /api/auth/verify-email
// @access  Public
router.get('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new AppError('Verification token is required', 400);
  }

  // Hash the token to compare with stored hash
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with this token and check if it's expired
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  // Update user
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully! You can now log in to your account.'
  });
}));

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    throw new AppError('Email is already verified', 400);
  }

  // Generate new verification token
  const verificationToken = user.createEmailVerificationToken();
  await user.save();

  // Send verification email
  const emailSent = await sendVerificationEmail(email, user.firstName, verificationToken);

  res.json({
    success: true,
    message: emailSent 
      ? 'Verification email sent successfully! Please check your inbox.' 
      : 'Verification email could not be sent. Please try again later.'
  });
}));

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    // Don't reveal if user exists or not for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }

  // Generate password reset token
  const resetToken = user.createPasswordResetToken();
  await user.save();

  // Send password reset email
  const emailSent = await sendPasswordResetEmail(email, user.firstName, resetToken);

  res.json({
    success: true,
    message: emailSent 
      ? 'Password reset email sent successfully! Please check your inbox.' 
      : 'Password reset email could not be sent. Please try again later.'
  });
}));

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { token, password } = req.body;

  // Hash the token to compare with stored hash
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with this token and check if it's expired
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.'
  });
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  // In a JWT-based system, logout is typically handled client-side
  // by removing the token. However, you could implement a blacklist
  // or use refresh tokens for more security.
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
