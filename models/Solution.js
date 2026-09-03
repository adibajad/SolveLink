const mongoose = require('mongoose');

const solutionSchema = new mongoose.Schema(
  {
    // Submitter Information & Linkage
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: [true, 'Challenge reference is required']
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitter is required']
    },
    // Explicit University / Institutional Linkage
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    institute: {
      type: String,
      trim: true,
      default: ''
    },
    organization: {
      type: String,
      trim: true,
      default: ''
    },
    team: {
      name: {
        type: String,
        trim: true,
        default: ''
      },
      members: [
        {
          name: { type: String, trim: true },
          email: { type: String, trim: true },
          role: { type: String, trim: true },
          organization: { type: String, trim: true }
        }
      ]
    },
    title: {
      type: String,
      required: [true, 'Solution title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Solution description is required'],
      trim: true
    },
    technicalApproach: {
      type: String,
      trim: true,
      default: ''
    },
    skills: [
      {
        type: String,
        trim: true
      }
    ],
    technology: [
      {
        type: String,
        trim: true
      }
    ],
    estimatedCost: {
      type: Number,
      default: 0,
      min: [0, 'Estimated cost cannot be negative']
    },
    impact: {
      type: String,
      trim: true,
      default: ''
    },
    implementationDetails: {
      type: String,
      trim: true,
      default: ''
    },
    attachments: [
      {
        type: String,
        trim: true
      }
    ],

    // Authority Evaluation Information (kept strictly separate from submitter info)
    evaluation: {
      score: {
        type: Number,
        min: [0, 'Score cannot be less than 0'],
        max: [100, 'Score cannot exceed 100']
      },
      feedback: {
        type: String,
        trim: true,
        default: ''
      },
      evaluatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      evaluatedAt: {
        type: Date
      }
    },

    // Solution Status
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'SELECTED',
        'ACCEPTED',
        'REJECTED',
        'IMPLEMENTATION'
      ],
      default: 'SUBMITTED',
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for naming flexibility
solutionSchema.virtual('challengeId').get(function() {
  return this.challenge;
});

// Pre-save hook ensuring university, universityId, and organization/institute are always populated
solutionSchema.pre('save', function(next) {
  if (!this.university && this.submittedBy) {
    this.university = this.submittedBy;
  }
  if (!this.universityId && this.submittedBy) {
    this.universityId = this.submittedBy;
  }
  if (!this.organization && this.team && this.team.members && this.team.members[0] && this.team.members[0].organization) {
    this.organization = this.team.members[0].organization;
  }
  if (!this.institute && this.organization) {
    this.institute = this.organization;
  }
  next();
});

const Solution = mongoose.model('Solution', solutionSchema);

module.exports = Solution;
