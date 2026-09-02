const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Problem title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Problem description is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    locationText: {
      type: String,
      trim: true,
      default: ''
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    images: [
      {
        type: String,
        trim: true
      }
    ],
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required']
    },
    supporters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM'
    },
    status: {
      type: String,
      enum: [
        'REPORTED',
        'COMMUNITY_REVIEW',
        'UNDER_VERIFICATION',
        'REJECTED',
        'ALREADY_RESOLVED',
        'VERIFIED',
        'CHALLENGE_CREATED',
        'IN_PROGRESS',
        'RESOLVED'
      ],
      default: 'REPORTED',
      required: true
    },
    affectedPeople: {
      type: String,
      enum: ['Only me', '2–10 people', '11–50 people', '51–100 people', '100+ people', ''],
      default: ''
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      default: null
    },
    duplicateReports: [
      {
        problem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Problem'
        },
        reportedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        similarityScore: {
          type: Number,
          default: 0
        },
        note: {
          type: String,
          default: ''
        },
        linkedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    similarProblems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem'
      }
    ],
    sentiment: {
      label: {
        type: String,
        enum: ['positive', 'neutral', 'negative', 'unknown'],
        default: 'neutral'
      },
      score: {
        type: Number,
        default: 0.5
      }
    },
    aiAnalysis: {
      category: { type: String, default: '' },
      severity: { type: String, default: '' },
      priority: { type: String, default: '' },
      sentiment: {
        label: { type: String, default: 'neutral' },
        score: { type: Number, default: 0.5 },
        confidence: { type: Number, default: 0.8 }
      },
      summary: { type: String, default: '' },
      confidenceScore: { type: Number, default: 0 },
      tags: [{ type: String }],
      analyzedAt: { type: Date }
    }
  },
  {
    timestamps: true
  }
);

const Problem = mongoose.model('Problem', problemSchema);

module.exports = Problem;
