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
        'REJECTED'
      ],
      default: 'SUBMITTED',
      required: true
    }
  },
  {
    timestamps: true
  }
);

const Solution = mongoose.model('Solution', solutionSchema);

module.exports = Solution;
