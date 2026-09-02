/**
 * SolveLink University & Innovator Matching Service
 * Calculates real match scores, matching skills, missing skills,
 * and ranked recommendations based on team profiles and challenge requirements.
 */

/**
 * Normalize and tokenize skill strings
 */
function normalizeSkill(skill = '') {
  return skill
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '');
}

/**
 * Calculate match between a challenge and a user/team profile
 * @param {Object} challenge - Challenge Mongoose document or object
 * @param {Object} user - User Mongoose document or session object
 * @returns {Object} Match analysis result
 */
const calculateMatch = (challenge = {}, user = {}) => {
  const reqSkills = Array.isArray(challenge.requiredSkills) ? challenge.requiredSkills : [];
  const userSkills = Array.isArray(user.skills) ? user.skills : [];

  if (reqSkills.length === 0) {
    return {
      matchScore: 75,
      matchingSkills: userSkills.slice(0, 2),
      missingSkills: [],
      matchReason: 'General civic challenge open for multi-disciplinary university and research teams.'
    };
  }

  const normalizedUserSkills = userSkills.map(normalizeSkill);
  const matchingSkills = [];
  const missingSkills = [];

  for (const skill of reqSkills) {
    const norm = normalizeSkill(skill);
    const hasMatch = normalizedUserSkills.some(
      us => us.includes(norm) || norm.includes(us)
    );

    if (hasMatch) {
      matchingSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Base score calculation from matching skills ratio
  let matchRatio = matchingSkills.length / reqSkills.length;
  
  // If user has organization or relevant skills, provide small baseline
  if (userSkills.length > 0 && matchingSkills.length === 0) {
    matchRatio = 0.20;
  }

  // Convert to 0 - 100 percentage
  let matchScore = Math.round(matchRatio * 100);

  // Add category alignment bonus if user organization / location matches
  if (user.location && challenge.location && challenge.location.toLowerCase().includes(user.location.toLowerCase())) {
    matchScore = Math.min(100, matchScore + 5);
  }

  // Minimum score clamp
  if (userSkills.length === 0) {
    matchScore = 50; // Neutral baseline for new profiles without skills listed
  }

  // Generate actionable explanation
  let matchReason = '';
  if (matchScore >= 80) {
    matchReason = `High Synergy: Your team possesses ${matchingSkills.length} of ${reqSkills.length} required skills (${matchingSkills.join(', ')}). Excellent fit for submission.`;
  } else if (matchScore >= 50) {
    matchReason = `Moderate Match: Your team matches in ${matchingSkills.join(', ') || 'core domains'}. Recommended to partner with specialists in ${missingSkills.slice(0, 2).join(', ') || 'supplementary disciplines'}.`;
  } else {
    matchReason = `Opportunity for Growth: Challenge requires ${missingSkills.join(', ')}. Cross-disciplinary collaboration recommended.`;
  }

  return {
    matchScore,
    matchingSkills,
    missingSkills,
    matchReason
  };
};

/**
 * Rank a list of challenges for a user profile
 * @param {Array} challenges
 * @param {Object} user
 * @returns {Array} Challenges sorted by matchScore descending with match metadata
 */
const rankChallengesForUser = (challenges = [], user = {}) => {
  return challenges
    .map(challenge => {
      const match = calculateMatch(challenge, user);
      return {
        ...challenge,
        matchScore: match.matchScore,
        matchingSkills: match.matchingSkills,
        missingSkills: match.missingSkills,
        matchReason: match.matchReason
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = {
  calculateMatch,
  rankChallengesForUser
};
