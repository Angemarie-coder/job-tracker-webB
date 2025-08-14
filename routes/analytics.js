const express = require('express');
const mongoose = require('mongoose');
const { query, validationResult } = require('express-validator');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/error');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get job statistics
// @route   GET /api/analytics/stats
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    console.log(`🔍 Getting stats for user: ${req.user._id}`);
    
    const stats = await Job.getUserStats(req.user._id.toString());
    console.log(`🔍 Raw stats from database:`, stats);
    
    // Convert array to object
    const statsObj = {
      total: 0,
      applied: 0,
      interviewing: 0,
      offered: 0,
      rejected: 0,
      withdrawn: 0
    };
    
    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });
    
    console.log(`🔍 Processed stats object:`, statsObj);

    res.json({
      success: true,
      data: {
        stats: statsObj
      }
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    throw error;
  }
}));

// @desc    Get job search timeline
// @route   GET /api/analytics/timeline
// @access  Private
router.get('/timeline', [
  query('months').optional().isInt({ min: 1, max: 24 }).withMessage('Months must be between 1 and 24')
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

  const months = parseInt(req.query.months) || 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const timeline = await Job.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
        applicationDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$applicationDate' },
          month: { $month: '$applicationDate' }
        },
        count: { $sum: 1 },
        statuses: {
          $push: '$status'
        }
      }
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    }
  ]);

  // Format timeline data
  const formattedTimeline = timeline.map(item => ({
    period: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    total: item.count,
    statuses: item.statuses.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {})
  }));

  res.json({
    success: true,
    data: {
      timeline: formattedTimeline
    }
  });
}));

// @desc    Get company insights
// @route   GET /api/analytics/companies
// @access  Private
router.get('/companies', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

  const limit = parseInt(req.query.limit) || 10;

  const companies = await Job.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $group: {
        _id: '$company',
        count: { $sum: 1 },
        statuses: {
          $push: '$status'
        },
        avgDaysSinceApplication: {
          $avg: {
            $divide: [
              { $subtract: [new Date(), '$applicationDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);

  // Calculate success rate for each company
  const companiesWithSuccessRate = companies.map(company => {
    const total = company.count;
    const successful = company.statuses.filter(status => 
      ['offered', 'interviewing'].includes(status)
    ).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      company: company._id,
      totalApplications: total,
      successRate: Math.round(successRate * 100) / 100,
      avgDaysSinceApplication: Math.round(company.avgDaysSinceApplication * 100) / 100,
      statusBreakdown: company.statuses.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    };
  });

  res.json({
    success: true,
    data: {
      companies: companiesWithSuccessRate
    }
  });
}));

// @desc    Get location insights
// @route   GET /api/analytics/locations
// @access  Private
router.get('/locations', asyncHandler(async (req, res) => {
  const locations = await Job.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
        location: { $exists: true, $ne: '' }
      }
    },
    {
      $group: {
        _id: '$location',
        count: { $sum: 1 },
        statuses: {
          $push: '$status'
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Calculate success rate for each location
  const locationsWithSuccessRate = locations.map(location => {
    const total = location.count;
    const successful = location.statuses.filter(status => 
      ['offered', 'interviewing'].includes(status)
    ).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      location: location._id,
      totalApplications: total,
      successRate: Math.round(successRate * 100) / 100,
      statusBreakdown: location.statuses.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    };
  });

  res.json({
    success: true,
    data: {
      locations: locationsWithSuccessRate
    }
  });
}));

// @desc    Get interview performance
// @route   GET /api/analytics/interviews
// @access  Private
router.get('/interviews', asyncHandler(async (req, res) => {
  const interviews = await Job.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
        'interviewDates.0': { $exists: true }
      }
    },
    {
      $unwind: '$interviewDates'
    },
    {
      $group: {
        _id: {
          type: '$interviewDates.type',
          outcome: '$interviewDates.outcome'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.type': 1, '_id.outcome': 1 }
    }
  ]);

  // Group by interview type
  const interviewPerformance = {};
  interviews.forEach(interview => {
    const { type, outcome } = interview._id;
    if (!interviewPerformance[type]) {
      interviewPerformance[type] = {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0
      };
    }
    
    interviewPerformance[type].total += interview.count;
    interviewPerformance[type][outcome] = interview.count;
  });

  // Calculate success rates
  Object.keys(interviewPerformance).forEach(type => {
    const stats = interviewPerformance[type];
    stats.successRate = stats.total > 0 ? 
      Math.round((stats.passed / stats.total) * 100 * 100) / 100 : 0;
  });

  res.json({
    success: true,
    data: {
      interviewPerformance
    }
  });
}));

// @desc    Get application trends
// @route   GET /api/analytics/trends
// @access  Private
router.get('/trends', [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Period must be week, month, quarter, or year')
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

  const period = req.query.period || 'month';
  let dateFormat, startDate;

  switch (period) {
    case 'week':
      dateFormat = { $week: '$applicationDate' };
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      dateFormat = { $month: '$applicationDate' };
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      dateFormat = { $quarter: '$applicationDate' };
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      dateFormat = { $year: '$applicationDate' };
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const trends = await Job.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(req.user._id),
        applicationDate: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: dateFormat,
        applications: { $sum: 1 },
        statuses: {
          $push: '$status'
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Calculate conversion rates
  const trendsWithConversion = trends.map(trend => {
    const total = trend.applications;
    const applied = trend.statuses.filter(status => status === 'applied').length;
    const interviewing = trend.statuses.filter(status => status === 'interviewing').length;
    const offered = trend.statuses.filter(status => status === 'offered').length;

    return {
      period: trend._id,
      totalApplications: total,
      applied,
      interviewing,
      offered,
      applicationToInterviewRate: total > 0 ? Math.round((interviewing / total) * 100 * 100) / 100 : 0,
      interviewToOfferRate: interviewing > 0 ? Math.round((offered / interviewing) * 100 * 100) / 100 : 0,
      overallSuccessRate: total > 0 ? Math.round((offered / total) * 100 * 100) / 100 : 0
    };
  });

  res.json({
    success: true,
    data: {
      period,
      trends: trendsWithConversion
    }
  });
}));

module.exports = router;
