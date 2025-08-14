const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100  characters']
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  status: {
    type: String,
    required: true,
    enum: ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'],
    default: 'applied'
  },
  salary: {
    type: String,
    trim: true,
    maxlength: [50, 'Salary cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [1000, 'Requirements cannot exceed 1000 characters']
  },
  applicationDate: {
    type: Date,
    required: [true, 'Application date is required']
  },
  jobUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Please provide a valid URL'
    }
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  followUpDate: {
    type: Date
  },
  interviewDates: [{
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['phone', 'video', 'onsite', 'technical', 'behavioral'],
      required: true
    },
    notes: String,
    outcome: {
      type: String,
      enum: ['passed', 'failed', 'pending'],
      default: 'pending'
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
jobSchema.index({ user: 1, status: 1 });
jobSchema.index({ user: 1, applicationDate: -1 });
jobSchema.index({ user: 1, company: 1 });
jobSchema.index({ user: 1, title: 'text', company: 'text', description: 'text' });

// Virtual for days since application
jobSchema.virtual('daysSinceApplication').get(function() {
  if (!this.applicationDate) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.applicationDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for next interview
jobSchema.virtual('nextInterview').get(function() {
  if (!this.interviewDates || this.interviewDates.length === 0) return null;
  
  const upcomingInterviews = this.interviewDates
    .filter(interview => interview.date > new Date())
    .sort((a, b) => a.date - b.date);
  
  return upcomingInterviews.length > 0 ? upcomingInterviews[0] : null;
});

// Pre-save middleware
jobSchema.pre('save', function(next) {
  // Auto-update follow-up date if status is interviewing
  if (this.status === 'interviewing' && !this.followUpDate) {
    this.followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  }
  next();
});

// Instance method to update status
jobSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  if (newStatus === 'interviewing' && !this.followUpDate) {
    this.followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  return this.save();
};

// Static method to get user's job statistics
jobSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Job', jobSchema);
