const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/error');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('jobCount');

  res.json({
    success: true,
    data: {
      user
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', [
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

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
router.put('/preferences', [
  body('jobTypes').optional().isArray(),
  body('jobTypes.*').optional().isIn(['full-time', 'part-time', 'contract', 'internship', 'freelance']),
  body('remotePreference').optional().isIn(['remote', 'hybrid', 'onsite']),
  body('salaryRange.min').optional().isNumeric(),
  body('salaryRange.max').optional().isNumeric(),
  body('salaryRange.currency').optional().isLength({ min: 3, max: 3 }),
  body('locations').optional().isArray(),
  body('industries').optional().isArray()
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
    { preferences: req.body },
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: {
      user
    }
  });
}));

// @desc    Add education
// @route   POST /api/users/education
// @access  Private
router.post('/education', [
  body('degree').trim().isLength({ min: 1, max: 100 }).withMessage('Degree is required'),
  body('institution').trim().isLength({ min: 1, max: 100 }).withMessage('Institution is required'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Valid year is required'),
  body('gpa').optional().isFloat({ min: 0, max: 4.0 }).withMessage('GPA must be between 0 and 4.0')
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
    { $push: { education: req.body } },
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  res.json({
    success: true,
    message: 'Education added successfully',
    data: {
      user
    }
  });
}));

// @desc    Update education
// @route   PUT /api/users/education/:educationId
// @access  Private
router.put('/education/:educationId', [
  body('degree').optional().trim().isLength({ min: 1, max: 100 }),
  body('institution').optional().trim().isLength({ min: 1, max: 100 }),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() }),
  body('gpa').optional().isFloat({ min: 0, max: 4.0 })
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

  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      'education._id': req.params.educationId
    },
    {
      $set: {
        'education.$.degree': req.body.degree,
        'education.$.institution': req.body.institution,
        'education.$.year': req.body.year,
        'education.$.gpa': req.body.gpa
      }
    },
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  if (!user) {
    throw new AppError('Education record not found', 404);
  }

  res.json({
    success: true,
    message: 'Education updated successfully',
    data: {
      user
    }
  });
}));

// @desc    Delete education
// @route   DELETE /api/users/education/:educationId
// @access  Private
router.delete('/education/:educationId', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { education: { _id: req.params.educationId } } },
    { new: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Education deleted successfully',
    data: {
      user
    }
  });
}));

// @desc    Upload resume
// @route   POST /api/users/resume
// @access  Private
router.post('/resume', asyncHandler(async (req, res) => {
  // This would typically handle file upload using multer
  // For now, we'll just update the resume field with the provided data
  
  const { filename, originalName, mimetype, size, url } = req.body;

  if (!filename || !originalName || !mimetype || !size || !url) {
    throw new AppError('All resume fields are required', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      resume: {
        filename,
        originalName,
        mimetype,
        size,
        url,
        uploadedAt: new Date()
      }
    },
    { new: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Resume uploaded successfully',
    data: {
      user
    }
  });
}));

// @desc    Delete resume
// @route   DELETE /api/users/resume
// @access  Private
router.delete('/resume', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { resume: 1 } },
    { new: true }
  ).select('-password');

  res.json({
    success: true,
    message: 'Resume deleted successfully',
    data: {
      user
    }
  });
}));

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('jobCount');

  // Get recent jobs (last 5)
  const recentJobs = await Job.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('title company status updatedAt');

  // Get upcoming interviews
  const upcomingInterviews = await Job.find({
    user: req.user._id,
    status: 'interviewing',
    'interviewDates.date': { $gte: new Date() }
  })
    .sort({ 'interviewDates.date': 1 })
    .limit(5)
    .select('title company interviewDates');

  // Get follow-up reminders
  const followUpReminders = await Job.find({
    user: req.user._id,
    followUpDate: { $gte: new Date() }
  })
    .sort({ followUpDate: 1 })
    .limit(5)
    .select('title company followUpDate');

  res.json({
    success: true,
    data: {
      user,
      recentJobs,
      upcomingInterviews,
      followUpReminders
    }
  });
}));

module.exports = router;
