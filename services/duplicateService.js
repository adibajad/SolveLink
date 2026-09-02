const Problem = require('../models/Problem');

/**
 * Common civic English stop-words for token normalization
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by', 'from', 'near', 'beside', 'about', 'issue', 'problem',
  'causing', 'there', 'this', 'that', 'these', 'those', 'has', 'have', 'had', 'been',
  'very', 'much', 'more', 'some', 'any', 'please', 'help', 'ward', 'road', 'street', 'area'
]);

/**
 * Tokenize and normalize string into clean keyword set
 */
function tokenizeText(str = '') {
  return new Set(
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function calculateJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate location keyword overlap score
 */
function calculateLocationOverlap(locA = '', locB = '') {
  const tokensA = locA.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const tokensB = locB.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) matches++;
  }
  return matches > 0 ? Math.min(1, matches / Math.min(tokensA.length, tokensB.length)) : 0;
}

/**
 * Calculate composite similarity score between input details and a candidate problem
 */
function calculateSimilarity(input, candidate) {
  const inputTitleTokens = tokenizeText(input.title || '');
  const candidateTitleTokens = tokenizeText(candidate.title || '');
  const titleScore = calculateJaccardSimilarity(inputTitleTokens, candidateTitleTokens);

  const inputDescTokens = tokenizeText(`${input.title || ''} ${input.description || ''}`);
  const candidateDescTokens = tokenizeText(`${candidate.title || ''} ${candidate.description || ''}`);
  const descScore = calculateJaccardSimilarity(inputDescTokens, candidateDescTokens);

  const isSameCategory = input.category && candidate.category &&
    input.category.toLowerCase().trim() === candidate.category.toLowerCase().trim();

  const locScore = calculateLocationOverlap(input.location || '', candidate.location || '');

  // Weighted scoring model:
  // Title text: 35%, Combined text: 30%, Location: 20%, Category: 15%
  let totalScore = (titleScore * 0.35) + (descScore * 0.30) + (locScore * 0.20);
  if (isSameCategory) {
    totalScore += 0.15;
  }

  // Cap between 0 and 0.99
  totalScore = Math.min(0.98, Math.max(0, totalScore));

  let reason = '';
  const percent = Math.round(totalScore * 100);

  if (locScore > 0.4 && isSameCategory && (titleScore > 0.3 || descScore > 0.3)) {
    reason = `Possible duplicate in ${candidate.location} under ${candidate.category} with matching infrastructure details.`;
  } else if (titleScore > 0.4 || descScore > 0.45) {
    reason = `High textual similarity with existing report: "${candidate.title}".`;
  } else if (isSameCategory && locScore > 0) {
    reason = `Related ${candidate.category} report located in the same vicinity (${candidate.location}).`;
  } else {
    reason = `Similar civic pattern detected (${percent}% keyword alignment).`;
  }

  return {
    score: Math.round(totalScore * 100) / 100,
    percentage: percent,
    reason,
    isSameCategory,
    locScore
  };
}

/**
 * Find top duplicate candidates in database for a given problem report
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.category
 * @param {string} params.location
 * @param {string} [params.excludeId]
 * @param {number} [params.limit=4]
 * @returns {Promise<Object>} Duplicate analysis result
 */
const findDuplicates = async ({ title, description, category, location, excludeId = null, limit = 4 }) => {
  try {
    const query = {
      status: { $ne: 'REJECTED' }
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const candidates = await Problem.find(query)
      .select('title description category location status supporters priority images createdAt')
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    const scoredMatches = [];

    for (const candidate of candidates) {
      const sim = calculateSimilarity({ title, description, category, location }, candidate);
      
      // Keep matches with similarity above 25% for exploration
      if (sim.score >= 0.25) {
        scoredMatches.push({
          problem: candidate,
          score: sim.score,
          percentage: sim.percentage,
          reason: sim.reason
        });
      }
    }

    // Sort descending by similarity score
    scoredMatches.sort((a, b) => b.score - a.score);

    const topMatches = scoredMatches.slice(0, limit);
    const bestMatch = topMatches.length > 0 ? topMatches[0] : null;
    const DUPLICATE_THRESHOLD = 0.50;
    const isDuplicate = Boolean(bestMatch && bestMatch.score >= DUPLICATE_THRESHOLD);

    return {
      isPotentialDuplicate: isDuplicate,
      score: bestMatch ? bestMatch.score : 0,
      percentage: bestMatch ? bestMatch.percentage : 0,
      matchedProblemId: isDuplicate ? bestMatch.problem._id : null,
      matchedProblem: isDuplicate ? bestMatch.problem : null,
      reason: bestMatch ? bestMatch.reason : 'No significant duplicates detected in this vicinity.',
      topMatches
    };
  } catch (error) {
    console.error('[Duplicate Service Error]', error);
    return {
      isPotentialDuplicate: false,
      score: 0,
      percentage: 0,
      matchedProblemId: null,
      matchedProblem: null,
      reason: 'Similarity analysis unavailable at this moment.',
      topMatches: []
    };
  }
};

/**
 * Check similar problems specifically for a given existing problem ID
 */
const getSimilarProblemsForDetail = async (problemId, limit = 3) => {
  try {
    const target = await Problem.findById(problemId).lean();
    if (!target) return [];

    const result = await findDuplicates({
      title: target.title,
      description: target.description,
      category: target.category,
      location: target.location,
      excludeId: target._id,
      limit
    });

    return result.topMatches || [];
  } catch (err) {
    console.error('[Get Similar Problems Error]', err);
    return [];
  }
};

module.exports = {
  findDuplicates,
  getSimilarProblemsForDetail,
  calculateSimilarity
};
