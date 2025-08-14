const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/error');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get all jobs for current user
// @route   GET /api/jobs
// @access  Private
router.get('/', [
  query('status').optional().isIn(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']),
  query('search').optional().isString(),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'applicationDate', 'title', 'company']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

  const {
    status,
    search,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = req.query;

  // Build query
  const query = { user: req.user._id };
  
  if (status) {
    query.status = status;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute query
  const jobs = await Job.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('user', 'firstName lastName email');

  // Get total count for pagination
  const total = await Job.countDocuments(query);

  res.json({
    success: true,
    data: {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Private
router.get('/:id', asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id).populate('user', 'firstName lastName email');
  
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  // Check if job belongs to current user
  if (job.user._id.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to access this job', 403);
  }

  res.json({
    success: true,
    data: {
      job
    }
  });
}));

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private
router.post('/', [
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Job title is required and must be less than 100 characters'),
  body('company').trim().isLength({ min: 1, max: 100 }).withMessage('Company name is required and must be less than 100 characters'),
  body('location').optional().trim().isLength({ max: 100 }),
  body('status').optional().isIn(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']),
  body('salary').optional().trim().isLength({ max: 50 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('requirements').optional().trim().isLength({ max: 1000 }),
  body('applicationDate').isISO8601().withMessage('Valid application date is required'),
  body('jobUrl').optional().isURL().withMessage('Please provide a valid URL'),
  body('contactPerson').optional().trim().isLength({ max: 100 }),
  body('contactEmail').optional().isEmail().withMessage('Please provide a valid email'),
  body('contactPhone').optional().trim().isLength({ max: 20 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
  body('tags').optional().isArray(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('followUpDate').optional().isISO8601()
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

  // Add user to job data
  const jobData = {
    ...req.body,
    user: req.user._id
  };

  const job = await Job.create(jobData);
  
  // Populate user data
  await job.populate('user', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Job created successfully',
    data: {
      job
    }
  });
}));

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
router.put('/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 100 }),
  body('company').optional().trim().isLength({ min: 1, max: 100 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('status').optional().isIn(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']),
  body('salary').optional().trim().isLength({ max: 50 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('requirements').optional().trim().isLength({ max: 1000 }),
  body('applicationDate').optional().isISO8601(),
  body('jobUrl').optional().isURL(),
  body('contactPerson').optional().trim().isLength({ max: 100 }),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional().trim().isLength({ max: 20 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
  body('tags').optional().isArray(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('followUpDate').optional().isISO8601()
], asyncHandler(async (req, res) => {
  try {
    console.log(`🔍 Updating job with ID: ${req.params.id}`);
    console.log(`🔍 Update data received:`, req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`❌ Validation errors:`, errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let job = await Job.findById(req.params.id);
    
    if (!job) {
      console.log(`❌ Job not found with ID: ${req.params.id}`);
      throw new AppError('Job not found', 404);
    }

    console.log(`🔍 Found job: ${job.title} at ${job.company}`);

    // Check if job belongs to current user
    if (job.user.toString() !== req.user._id.toString()) {
      console.log(`❌ Unauthorized update attempt. Job user: ${job.user}, Request user: ${req.user._id}`);
      throw new AppError('Not authorized to update this job', 403);
    }

    console.log(`✅ Authorized to update job. Proceeding with update...`);
    
    // Update job
    job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('user', 'firstName lastName email');

    console.log(`✅ Job updated successfully:`, job);

    res.json({
      success: true,
      message: 'Job updated successfully',
      data: {
        job
      }
    });
  } catch (error) {
    console.error('❌ Error in update job route:', error);
    throw error;
  }
}));

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
router.delete('/:id', asyncHandler(async (req, res) => {
  console.log(`🔍 Attempting to delete job with ID: ${req.params.id}`);
  
  try {
    // Simple and direct approach
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      console.log(`❌ Job not found with ID: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    console.log(`🔍 Found job: ${job.title} at ${job.company}`);

    // Check if job belongs to current user
    if (job.user.toString() !== req.user._id.toString()) {
      console.log(`❌ Unauthorized delete attempt. Job user: ${job.user}, Request user: ${req.user._id}`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    console.log(`✅ Authorized to delete job. Proceeding with deletion...`);
    
    // Delete the job directly
    await Job.findByIdAndDelete(req.params.id);
    
    console.log(`✅ Job deleted successfully`);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error in delete job route:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

// @desc    Update job status
// @route   PATCH /api/jobs/:id/status
// @access  Private
router.patch('/:id/status', [
  body('status').isIn(['applied', 'interviewing', 'offered', 'rejected', 'withdrawn']).withMessage('Valid status is required')
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

  const { status } = req.body;

  let job = await Job.findById(req.params.id);
  
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  // Check if job belongs to current user
  if (job.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to update this job', 403);
  }

  // Update status using instance method
  await job.updateStatus(status);
  
  // Populate user data
  await job.populate('user', 'firstName lastName email');

  res.json({
    success: true,
    message: 'Job status updated successfully',
    data: {
      job
    }
  });
}));

// @desc    Add interview to job
// @route   POST /api/jobs/:id/interviews
// @access  Private
router.post('/:id/interviews', [
  body('date').isISO8601().withMessage('Valid interview date is required'),
  body('type').isIn(['phone', 'video', 'onsite', 'technical', 'behavioral']).withMessage('Valid interview type is required'),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('outcome').optional().isIn(['passed', 'failed', 'pending'])
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

  const { date, type, notes, outcome } = req.body;

  let job = await Job.findById(req.params.id);
  
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  // Check if job belongs to current user
  if (job.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to update this job', 403);
  }

  // Add interview
  job.interviewDates.push({
    date,
    type,
    notes,
    outcome: outcome || 'pending'
  });

  // Update status to interviewing if not already
  if (job.status === 'applied') {
    job.status = 'interviewing';
  }

  await job.save();
  
  // Populate user data
  await job.populate('user', 'firstName lastName email');

  res.json({
    success: true,
    message: 'Interview added successfully',
    data: {
      job
    }
  });
}));

module.exports = router;
