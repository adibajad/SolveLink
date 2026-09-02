const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');

const checkDb = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solvelink';
    await mongoose.connect(uri);
    
    const User = require('../models/User');
    const Problem = require('../models/Problem');
    const Challenge = require('../models/Challenge');
    const Solution = require('../models/Solution');
    const users = await User.find({}).select('name email role isVerified createdAt').lean();
    const problems = await Problem.find({}).select('title category status reportedBy supporters images createdAt').lean();
    const challenges = await Challenge.find({}).select('title category status createdBy sourceProblem createdAt').lean();
    const solutions = await Solution.find({}).select('title status submittedBy challenge createdAt').lean();

    console.log(JSON.stringify({
      userCount: users.length,
      users,
      problemCount: problems.length,
      problems: problems.map(p => ({ id: p._id, title: p.title, status: p.status, supportersCount: p.supporters?.length, images: p.images })),
      challengeCount: challenges.length,
      challenges: challenges.map(c => ({ id: c._id, title: c.title, status: c.status })),
      solutionCount: solutions.length,
      solutions: solutions.map(s => ({ id: s._id, title: s.title, status: s.status }))
    }, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkDb();
