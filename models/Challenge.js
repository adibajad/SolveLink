const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Challenge title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Challenge description is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    location: {
      type: String,
      trim: true,
      default: ''
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    image: {
      type: String,
      trim: true,
      default: ''
    },
    images: [
      {
        type: String,
        trim: true
      }
    ],
    requiredSkills: [
      {
        type: String,
        trim: true
      }
    ],
    requiredTechnologies: [
      {
        type: String,
        trim: true
      }
    ],
    authoritySector: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    domainName: {
      type: String,
      trim: true,
      default: ''
    },
    constraints: [
      {
        type: String,
        trim: true
      }
    ],
    requirements: [
      {
        type: String,
        trim: true
      }
    ],
    expectedOutcome: {
      type: String,
      trim: true,
      default: ''
    },
    evaluationCriteria: [
      {
        type: String,
        trim: true
      }
    ],
    deadline: {
      type: Date
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PUBLISHED',
        'OPEN',
        'UNDER_REVIEW',
        'CLOSED',
        'SOLUTION_SELECTED',
        'APPROVED',
        'IMPLEMENTATION',
        'COMPLETED'
      ],
      default: 'DRAFT',
      required: true
    },
    sourceProblem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Source verified problem is required']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator authority is required']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for naming flexibility
challengeSchema.virtual('domain').get(function() {
  return this.domainName || this.category;
});
challengeSchema.virtual('authorityId').get(function() {
  return this.createdBy;
});

const Challenge = mongoose.model('Challenge', challengeSchema);

module.exports = Challenge;
