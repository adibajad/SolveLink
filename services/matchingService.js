/**
 * SolveLink Stakeholder Matching & Problem Routing Service
 * Implements deterministic database-driven matching:
 * 1. Citizen Problem -> Registered Authority (domain, jurisdiction, department, capabilities)
 * 2. Challenge -> University Team (domains, required skills, technologies, location)
 * 3. Challenge / Solution -> Industry Partner (sector, capabilities, technologies, scale)
 */

const User = require('../models/User');

/**
 * Normalize and tokenize strings
 */
function normalizeString(str = '') {
  return str
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * -----------------------------------------------------------------------------
 * 1. PROBLEM -> AUTHORITY MATCHING ENGINE
 * -----------------------------------------------------------------------------
 * Deterministically routes an AI-classified problem to the best registered Authority.
 * 
 * Rules:
 * - AI classification defines: domain, category, subCategory, urgency.
 * - Matching engine queries MongoDB for registered users with role: 'authority'.
 * - Scoring:
 *     Domain / Sector Match = 50 pts (mandatory baseline)
 *     Jurisdiction / Location Match = 30 pts
 *     Department Detail Match = 10 pts
 *     Category / Capability Match = 10 pts
 * - If score < 45 or no authority found -> status: 'needs_review'
 * 
 * @param {Object} classification - Output from aiService.analyzeProblem
 * @param {string} problemLocation - Citizen reported location/landmark
 * @returns {Promise<Object>} { bestAuthority, score, assignmentStatus, assignmentReason }
 */
const matchAuthorityForProblem = async (classification = {}, problemLocation = '') => {
  try {
    const authorities = await User.find({ role: 'authority', isVerified: { $ne: false } }).lean();

    if (!authorities || authorities.length === 0) {
      return {
        bestAuthority: null,
        score: 0,
        assignmentStatus: 'needs_review',
        assignmentReason: 'No registered authorities found in the platform database. Queued for central administration review.'
      };
    }

    const targetDomain = (classification.domain || '').toLowerCase().trim();
    const targetCategory = (classification.category || '').toLowerCase().trim();
    const targetLoc = (problemLocation || '').toLowerCase().trim();

    let bestAuthority = null;
    let highestScore = 0;
    let scoreDetails = { domainMatched: false, locationMatched: false };

    for (const auth of authorities) {
      let score = 0;
      const authSector = (auth.authoritySector || '').toLowerCase().trim();
      const authDept = (auth.department || auth.organization || '').toLowerCase().trim();
      const authJurisdiction = (auth.jurisdiction || auth.location || '').toLowerCase().trim();
      const authSkills = Array.isArray(auth.skills) ? auth.skills.map(s => s.toLowerCase().trim()) : [];

      // 1. Sector / Domain Match (Highest Weight: 50 pts)
      let domainMatched = false;
      if (authSector && authSector === targetDomain) {
        score += 50;
        domainMatched = true;
      } else if (authSector && authSector === 'municipal_corporation') {
        // Municipal corporation is eligible as cross-civic fallback
        score += 35;
        domainMatched = true;
      } else if (authDept && (authDept.includes(targetDomain.replace(/_/g, ' ')) || authDept.includes(targetDomain))) {
        score += 40;
        domainMatched = true;
      }

      // If domain does not match at all, this authority is ineligible
      if (!domainMatched) {
        continue;
      }

      // 2. Jurisdiction / Location Match (High Weight: 30 pts)
      let locationMatched = false;
      if (authJurisdiction && targetLoc) {
        const authTokens = authJurisdiction.split(/[\s,]+/).filter(w => w.length > 2);
        const locTokens = targetLoc.split(/[\s,]+/).filter(w => w.length > 2);
        const hasOverlap = authTokens.some(t => targetLoc.includes(t) || locTokens.includes(t));

        if (hasOverlap || authJurisdiction.includes(targetLoc) || targetLoc.includes(authJurisdiction)) {
          score += 30;
          locationMatched = true;
        } else {
          // In same state/general area
          score += 10;
        }
      } else {
        // Broad statewide jurisdiction
        score += 15;
      }

      // 3. Category / Capability Match (Medium Weight: 10 pts)
      if (targetCategory) {
        const catWord = targetCategory.replace(/_/g, ' ');
        if (authDept.includes(catWord) || authSkills.some(s => s.includes(catWord) || catWord.includes(s))) {
          score += 10;
        }
      }

      // 4. Specific Department Detail (Additional Weight: 10 pts)
      if (auth.department && auth.department.trim().length > 0) {
        score += 10;
      }

      if (score > highestScore) {
        highestScore = score;
        bestAuthority = auth;
        scoreDetails = { domainMatched, locationMatched };
      }
    }

    // Minimum routing threshold: 45 points (requires sector match)
    if (bestAuthority && highestScore >= 45) {
      const locText = scoreDetails.locationMatched ? 'matching jurisdiction' : 'general jurisdiction';
      const sectorName = bestAuthority.authoritySector
        ? bestAuthority.authoritySector.replace(/_/g, ' ')
        : 'applicable';

      return {
        bestAuthority,
        score: highestScore,
        assignmentStatus: 'assigned',
        assignmentReason: `Routed to ${bestAuthority.name} (${bestAuthority.department || bestAuthority.organization || sectorName}) based on ${sectorName} sector match and ${locText}.`
      };
    }

    return {
      bestAuthority: null,
      score: highestScore,
      assignmentStatus: 'needs_review',
      assignmentReason: `No matching authority registered for sector "${targetDomain.replace(/_/g, ' ')}" in "${problemLocation || 'this region'}". Marked for triage.`
    };
  } catch (error) {
    console.error('[Authority Matching Engine Error]', error);
    return {
      bestAuthority: null,
      score: 0,
      assignmentStatus: 'needs_review',
      assignmentReason: 'Matching engine encountered an unexpected error. Routed to manual review.'
    };
  }
};

/**
 * -----------------------------------------------------------------------------
 * 2. CHALLENGE -> UNIVERSITY MATCHING ENGINE
 * -----------------------------------------------------------------------------
 * Compares Challenge requirements against University profiles (domains, skills, technologies).
 * 
 * @param {Object} challenge
 * @param {Object} user - University User document or session user
 * @returns {Object} { matchScore, matchingSkills, missingSkills, matchReason }
 */
const calculateMatch = (challenge = {}, user = {}) => {
  const reqSkills = Array.isArray(challenge.requiredSkills) ? challenge.requiredSkills : [];
  const reqTechs = Array.isArray(challenge.requiredTechnologies) ? challenge.requiredTechnologies : [];
  const userSkills = Array.isArray(user.skills) ? user.skills : [];
  const userTechs = Array.isArray(user.technologies) ? user.technologies : [];
  const userDomains = Array.isArray(user.domains) ? user.domains.map(normalizeString) : [];

  let totalPoints = 0;

  // 1. Domain Alignment (30 pts)
  const chDomain = normalizeString(challenge.domain || challenge.category || '');
  const chSector = normalizeString(challenge.authoritySector || '');
  if (
    (chDomain && userDomains.some(ud => ud.includes(chDomain) || chDomain.includes(ud))) ||
    (chSector && userDomains.some(ud => ud.includes(chSector) || chSector.includes(ud)))
  ) {
    totalPoints += 30;
  } else if (userDomains.length === 0) {
    totalPoints += 15; // neutral baseline if domains unlisted
  }

  // 2. Required Skills Match (40 pts)
  const normalizedUserSkills = userSkills.map(normalizeString);
  const matchingSkills = [];
  const missingSkills = [];

  for (const skill of reqSkills) {
    const norm = normalizeString(skill);
    const hasMatch = normalizedUserSkills.some(us => us.includes(norm) || norm.includes(us));
    if (hasMatch) matchingSkills.push(skill);
    else missingSkills.push(skill);
  }

  if (reqSkills.length > 0) {
    const skillRatio = matchingSkills.length / reqSkills.length;
    totalPoints += Math.round(skillRatio * 40);
  } else {
    totalPoints += 30;
  }

  // 3. Technologies Match (20 pts)
  const normalizedUserTechs = userTechs.map(normalizeString);
  const matchingTechs = [];
  for (const tech of reqTechs) {
    const norm = normalizeString(tech);
    if (normalizedUserTechs.some(ut => ut.includes(norm) || norm.includes(ut))) {
      matchingTechs.push(tech);
    }
  }

  if (reqTechs.length > 0) {
    totalPoints += Math.round((matchingTechs.length / reqTechs.length) * 20);
  } else {
    totalPoints += 15;
  }

  // 4. Location Proximity (10 pts)
  if (user.location && challenge.location && challenge.location.toLowerCase().includes(user.location.toLowerCase())) {
    totalPoints += 10;
  } else {
    totalPoints += 5;
  }

  const matchScore = Math.min(100, Math.max(30, totalPoints));

  let matchReason = '';
  if (matchScore >= 80) {
    matchReason = `High Synergy: Strong capability match in ${matchingSkills.join(', ') || 'core domains'}. Excellent fit for submission.`;
  } else if (matchScore >= 55) {
    matchReason = `Moderate Match: Matches in ${matchingSkills.join(', ') || 'key engineering fields'}. Consider partnering for ${missingSkills.slice(0, 2).join(', ') || 'supplementary areas'}.`;
  } else {
    matchReason = `Growth Opportunity: Challenge requires ${missingSkills.slice(0, 3).join(', ') || 'specialized expertise'}. Cross-lab collaboration recommended.`;
  }

  return {
    matchScore,
    matchingSkills,
    missingSkills,
    matchReason
  };
};

/**
 * Rank a list of challenges for a university user
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

/**
 * -----------------------------------------------------------------------------
 * 3. SOLUTION / CHALLENGE -> INDUSTRY MATCHING ENGINE
 * -----------------------------------------------------------------------------
 * Compares technical solutions with Industry partner capabilities (domains, skills, technologies, capabilities).
 * 
 * @param {Object} solution
 * @param {Object} industryUser
 * @returns {Object} { synergyScore, matchedCapabilities, complementaryCapabilities, matchReason }
 */
const calculateIndustrySolutionMatch = (solution = {}, industryUser = {}) => {
  const indSkills = Array.isArray(industryUser.skills) ? industryUser.skills.map(normalizeString) : [];
  const indTechs = Array.isArray(industryUser.technologies) ? industryUser.technologies.map(normalizeString) : [];
  const indCapabilities = Array.isArray(industryUser.capabilities) ? industryUser.capabilities.map(normalizeString) : [];
  const indDomains = Array.isArray(industryUser.domains) ? industryUser.domains.map(normalizeString) : [];

  const solSkills = [
    ...(Array.isArray(solution.skills) ? solution.skills : []),
    ...(Array.isArray(solution.technology) ? solution.technology : [])
  ];

  const chSkills = solution.challenge && Array.isArray(solution.challenge.requiredSkills)
    ? solution.challenge.requiredSkills
    : [];

  const combinedTargets = [...new Set([...solSkills, ...chSkills])];
  const matchedCapabilities = [];
  const complementaryCapabilities = [];

  for (const item of combinedTargets) {
    const norm = normalizeString(item);
    const hasMatch = indSkills.some(s => s.includes(norm) || norm.includes(s)) ||
                     indTechs.some(t => t.includes(norm) || norm.includes(t));

    if (hasMatch) matchedCapabilities.push(item);
    else complementaryCapabilities.push(item);
  }

  let totalPoints = 0;

  // 1. Sector / Domain Match (35 pts)
  const chSector = normalizeString(solution.challenge?.authoritySector || solution.challenge?.category || '');
  if (chSector && (indDomains.some(d => d.includes(chSector) || chSector.includes(d)) || normalizeString(industryUser.industrySector).includes(chSector))) {
    totalPoints += 35;
  } else {
    totalPoints += 18;
  }

  // 2. Skills & Tech Stack Alignment (35 pts)
  if (combinedTargets.length > 0) {
    const ratio = matchedCapabilities.length / combinedTargets.length;
    totalPoints += Math.round(ratio * 35);
  } else {
    totalPoints += 20;
  }

  // 3. Implementation Capabilities (20 pts)
  if (indCapabilities.length > 0) {
    totalPoints += 20;
  } else {
    totalPoints += 12;
  }

  // 4. Proximity Boost (10 pts)
  const chLoc = solution.challenge?.location || '';
  if (industryUser.location && chLoc) {
    const indTokens = normalizeString(industryUser.location).split(' ').filter(w => w.length > 2);
    const chNorm = normalizeString(chLoc);
    if (indTokens.some(t => chNorm.includes(t)) || chNorm.includes(normalizeString(industryUser.location))) {
      totalPoints += 10;
    } else {
      totalPoints += 5;
    }
  } else {
    totalPoints += 5;
  }

  const synergyScore = Math.min(98, Math.max(30, totalPoints));

  let matchReason = '';
  if (synergyScore >= 75) {
    matchReason = `High Implementation Synergy: Industrial capabilities match key solution technologies (${matchedCapabilities.slice(0, 3).join(', ')}). Ideal candidate for pilot production and scaling.`;
  } else if (synergyScore >= 50) {
    matchReason = `Strong Complementary Fit: Offers manufacturing and field deployment support alongside university prototype engineering.`;
  } else {
    matchReason = `Cross-Sector Opportunity: Solution seeks scaling or validation support in ${complementaryCapabilities.slice(0, 2).join(', ') || 'field operations'}.`;
  }

  return {
    synergyScore,
    matchedCapabilities,
    complementaryCapabilities,
    matchReason
  };
};

/**
 * Rank university solutions for an industry partner
 */
const rankSolutionsForIndustry = (solutions = [], industryUser = {}) => {
  return solutions
    .map(solution => {
      const match = calculateIndustrySolutionMatch(solution, industryUser);
      return {
        ...solution,
        synergyScore: match.synergyScore,
        matchedCapabilities: match.matchedCapabilities,
        complementaryCapabilities: match.complementaryCapabilities,
        matchReason: match.matchReason
      };
    })
    .sort((a, b) => b.synergyScore - a.synergyScore);
};

module.exports = {
  matchAuthorityForProblem,
  calculateMatch,
  rankChallengesForUser,
  calculateIndustrySolutionMatch,
  rankSolutionsForIndustry
};
