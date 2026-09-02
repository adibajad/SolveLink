const mongoose = require('mongoose');

const collaborationSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solution',
      required: [true, 'Solution proposal reference is required']
    },
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: [true, 'Challenge reference is required']
    },
    industry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Industry partner reference is required']
    },
    supportType: {
      type: String,
      enum: [
        'PILOT_IMPLEMENTATION',
        'EQUIPMENT_SPONSORSHIP',
        'TECHNICAL_MENTORSHIP',
        'FIELD_VALIDATION',
        'COMMERCIALIZATION'
      ],
      default: 'PILOT_IMPLEMENTATION'
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: [
        'INTERESTED',
        'PENDING',
        'ACCEPTED',
        'DECLINED',
        'IN_PARTNERSHIP'
      ],
      default: 'INTERESTED'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for naming flexibility
collaborationSchema.virtual('proposalId').get(function() {
  return this.proposal;
});
collaborationSchema.virtual('challengeId').get(function() {
  return this.challenge;
});
collaborationSchema.virtual('industryId').get(function() {
  return this.industry;
});
collaborationSchema.virtual('notes').get(function() {
  return this.message;
});

const Collaboration = mongoose.model('Collaboration', collaborationSchema);

module.exports = Collaboration;
