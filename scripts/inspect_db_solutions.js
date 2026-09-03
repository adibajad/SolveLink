const mongoose = require('mongoose');
const User = require('../models/User');
const Solution = require('../models/Solution');
const Challenge = require('../models/Challenge');

const uri = 'mongodb://solvelink_admin:vNSpes8UpWuRfugq@ac-abwezmd-shard-00-00.iwavan7.mongodb.net:27017,ac-abwezmd-shard-00-01.iwavan7.mongodb.net:27017,ac-abwezmd-shard-00-02.iwavan7.mongodb.net:27017/solvelink?ssl=true&authSource=admin&appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('Connected to MongoDB Atlas!');

    console.log('\n=== USERS (University) ===');
    const users = await User.find({ role: 'university' }).lean();
    users.forEach(u => {
      console.log(`User _id: ${u._id}, name: "${u.name}", email: "${u.email}", org: "${u.organization}", role: "${u.role}"`);
    });

    console.log('\n=== ALL USERS WITH Birsa / BIT ===');
    const birsaUsers = await User.find({ $or: [{ name: /birsa/i }, { organization: /birsa/i }] }).lean();
    birsaUsers.forEach(u => {
      console.log(`Birsa user _id: ${u._id}, name: "${u.name}", email: "${u.email}", org: "${u.organization}", role: "${u.role}"`);
    });

    console.log('\n=== CHALLENGES ===');
    const challenges = await Challenge.find({ $or: [{ title: /garbage/i }, { _id: '6a98fe56e31322228615d77d' }] }).lean();
    challenges.forEach(c => {
      console.log(`Challenge _id: ${c._id}, title: "${c.title}", status: "${c.status}"`);
    });

    console.log('\n=== ALL SOLUTIONS IN DATABASE ===');
    const solutions = await Solution.find().lean();
    console.log(`Total Solutions found: ${solutions.length}`);
    solutions.forEach(s => {
      console.log(JSON.stringify({
        _id: s._id,
        title: s.title,
        challenge: s.challenge,
        submittedBy: s.submittedBy,
        team: s.team,
        status: s.status,
        createdAt: s.createdAt
      }, null, 2));
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
