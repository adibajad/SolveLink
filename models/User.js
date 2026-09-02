const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
      type: String,
      enum: ['citizen', 'authority', 'university', 'industry', 'admin'],
      default: 'citizen',
      required: true
    },
    organization: {
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
    location: {
      type: String,
      trim: true,
      default: ''
    },
    // Authority Structured Profile Fields
    authoritySector: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    jurisdiction: {
      type: String,
      trim: true,
      default: ''
    },
    // Industry Structured Profile Fields
    industrySector: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    capabilities: [
      {
        type: String,
        trim: true
      }
    ],
    // University & Cross-Stakeholder Domains & Technologies
    domains: [
      {
        type: String,
        trim: true
      }
    ],
    technologies: [
      {
        type: String,
        trim: true
      }
    ],
    isVerified: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
