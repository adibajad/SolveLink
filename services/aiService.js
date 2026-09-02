/**
 * SolveLink AI Service
 * Isolated server-side AI reasoning engine for problem categorization,
 * sentiment analysis, severity estimation, priority recommendation, and keyword extraction.
 * 
 * Rules:
 * - AI assists decisions; it does NOT replace official government verification.
 * - Sentiment analysis is a SUPPORTING signal and does NOT dictate severity on its own.
 * - Browser code never calls AI APIs directly.
 * - Secrets and keys remain strictly server-side without external dependencies.
 */

/**
 * Intelligent civic classification dictionary
 */
const CIVIC_TAXONOMY = {
  'Water & Sanitation': {
    keywords: ['water', 'pipe', 'leak', 'drainage', 'sewage', 'borewell', 'arsenic', 'drinking water', 'contamination', 'tap', 'well', 'overflow', 'gutter', 'sanitation'],
    department: 'Department of Drinking Water & Sanitation / Municipal Jal Board',
    defaultSeverity: 'HIGH'
  },
  'Infrastructure': {
    keywords: ['road', 'pothole', 'bridge', 'pavement', 'culvert', 'flyover', 'street', 'crack', 'asphalt', 'divider', 'traffic light', 'streetlight', 'footpath', 'collapse'],
    department: 'Public Works Department (PWD) / Urban Local Body',
    defaultSeverity: 'MEDIUM'
  },
  'Public Health': {
    keywords: ['hospital', 'clinic', 'asha', 'medicine', 'phc', 'doctor', 'ambulance', 'disease', 'dengue', 'malaria', 'vaccine', 'health', 'fever', 'medical'],
    department: 'Department of Health & Family Welfare / District Health Society',
    defaultSeverity: 'CRITICAL'
  },
  'Agriculture & Energy': {
    keywords: ['crop', 'farmer', 'irrigation', 'storage', 'solar', 'electricity', 'power outage', 'transformer', 'grid', 'cold storage', 'agriculture', 'forest produce', 'harvest'],
    department: 'Department of Agriculture & State Electricity Distribution Company',
    defaultSeverity: 'MEDIUM'
  },
  'Waste Management': {
    keywords: ['garbage', 'waste', 'dump', 'trash', 'plastic', 'landfill', 'litter', 'compost', 'recycling', 'debris', 'solid waste'],
    department: 'Municipal Solid Waste Management Directorate',
    defaultSeverity: 'MEDIUM'
  },
  'Education & Digital': {
    keywords: ['school', 'classroom', 'digital', 'internet', 'connectivity', 'teacher', 'computer', 'student', 'blackboard', 'library', 'learning'],
    department: 'Department of School Education & Literacy',
    defaultSeverity: 'LOW'
  }
};

/**
 * Civic & Emotional Sentiment Lexicon
 * Maps sentiment polarity and intensity for community civic reports
 */
const SENTIMENT_LEXICON = {
  // Strong Negative (-3 to -4)
  'frustrated': -3.5,
  'frustrating': -3.2,
  'frustration': -3.2,
  'terrible': -3.8,
  'horrible': -3.8,
  'pathetic': -3.6,
  'worst': -4.0,
  'disaster': -3.5,
  'crisis': -3.4,
  'unbearable': -3.7,
  'neglected': -3.2,
  'negligence': -3.4,
  'suffering': -3.5,
  'unusable': -3.0,
  'chaos': -3.0,
  'helpless': -3.2,
  'distress': -3.2,
  'furious': -3.8,
  'angry': -3.0,

  // Moderate Negative (-1 to -2.5)
  'damaged': -2.2,
  'damage': -2.0,
  'broken': -2.0,
  'danger': -2.8,
  'dangerous': -2.8,
  'hazard': -2.6,
  'hazardous': -2.6,
  'delay': -1.8,
  'delayed': -1.8,
  'dirty': -2.0,
  'filthy': -2.6,
  'poor': -2.0,
  'bad': -2.2,
  'fault': -1.8,
  'failure': -2.2,
  'leak': -1.5,
  'leaking': -1.6,
  'leakage': -1.6,
  'stench': -2.4,
  'smell': -1.6,
  'blocked': -1.8,
  'blockage': -1.8,
  'overflow': -1.8,
  'overflowing': -2.0,
  'unsafe': -2.6,
  'risk': -2.0,
  'trouble': -2.0,
  'accident': -2.8,
  'decay': -2.0,
  'pothole': -1.6,
  'potholes': -1.6,
  'crack': -1.4,
  'cracked': -1.6,
  'stagnant': -1.8,
  'waterlogging': -2.0,
  'waterlogged': -2.0,
  'complaint': -1.5,
  'pain': -2.5,
  'stopped': -1.5,

  // Strong Positive (+3 to +4)
  'excellent': 3.8,
  'wonderful': 3.6,
  'fantastic': 3.8,
  'satisfied': 3.4,
  'appreciated': 3.2,
  'appreciate': 3.2,
  'great': 3.0,

  // Moderate Positive (+1 to +2.5)
  'good': 2.0,
  'functioning': 2.2,
  'functioning normally': 2.5,
  'normal': 1.8,
  'normally': 2.0,
  'working': 1.8,
  'clean': 2.2,
  'safe': 2.4,
  'improved': 2.2,
  'resolved': 2.6,
  'fixed': 2.4,
  'prompt': 2.2,
  'efficient': 2.4,
  'helpful': 2.0,
  'smooth': 2.0,
  'smoothly': 2.0,
  'fine': 1.6,
  'well': 1.6,
  'thanks': 2.0,
  'thank': 1.8
};

// Modifiers (Negations & Boosters)
const NEGATIONS = new Set(['not', 'no', 'never', 'hardly', 'barely', 'scarcely', 'without', 'lack', 'none']);
const BOOSTERS = {
  'very': 1.5,
  'extremely': 1.8,
  'completely': 1.8,
  'severely': 1.8,
  'totally': 1.6,
  'highly': 1.5,
  'deeply': 1.5,
  'really': 1.4,
  'quite': 1.3
};

/**
 * Lightweight local server-side NLP sentiment analyzer
 * @param {string} text - The input problem description or title
 * @returns {Object} { label: 'positive'|'neutral'|'negative'|'unknown', score: Number, confidence: Number }
 */
const analyzeSentiment = (text = '') => {
  try {
    if (!text || typeof text !== 'string') {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0.5
      };
    }

    const cleanText = text.toLowerCase().trim();
    if (!cleanText) {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0.5
      };
    }

    // Tokenize into clean words
    const tokens = cleanText
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    if (tokens.length === 0) {
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0.5
      };
    }

    let totalScore = 0;
    let matchedTermsCount = 0;

    // Check bigrams first (e.g. 'functioning normally')
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (SENTIMENT_LEXICON[bigram] !== undefined) {
        let val = SENTIMENT_LEXICON[bigram];
        // Check negation before bigram
        if (i > 0 && NEGATIONS.has(tokens[i - 1])) {
          val = -val * 0.8;
        }
        totalScore += val;
        matchedTermsCount += 2;
      }
    }

    // Check individual unigram tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (SENTIMENT_LEXICON[token] !== undefined) {
        let val = SENTIMENT_LEXICON[token];

        // Check booster modifier on immediate previous word
        if (i > 0 && BOOSTERS[tokens[i - 1]]) {
          val *= BOOSTERS[tokens[i - 1]];
        }

        // Check negation within 2 previous words
        const isNegated = (i > 0 && NEGATIONS.has(tokens[i - 1])) || 
                          (i > 1 && NEGATIONS.has(tokens[i - 2]));

        if (isNegated) {
          val = -val * 0.8;
        }

        totalScore += val;
        matchedTermsCount++;
      }
    }

    // Normalized Score mapping to [0.00, 1.00]
    // 0.00 = Extremely Negative, 0.50 = Neutral, 1.00 = Extremely Positive
    let normalizedScore = 0.50;
    if (matchedTermsCount > 0) {
      // Normalize using standard hyperbolic tangent curve
      const comparative = totalScore / (Math.sqrt(tokens.length) + 1.5);
      normalizedScore = 0.50 + 0.50 * Math.tanh(comparative / 2.5);
      // Round to 2 decimal places
      normalizedScore = Math.max(0, Math.min(1, Math.round(normalizedScore * 100) / 100));
    }

    // Categorize Label
    let label = 'neutral';
    if (normalizedScore <= 0.42) {
      label = 'negative';
    } else if (normalizedScore >= 0.58) {
      label = 'positive';
    } else {
      label = 'neutral';
    }

    const confidence = matchedTermsCount > 0 
      ? Math.min(0.95, 0.70 + (matchedTermsCount * 0.05))
      : 0.60;

    return {
      label,
      score: normalizedScore,
      confidence
    };

  } catch (error) {
    console.warn('[Sentiment Engine Notice] Graceful fallback invoked:', error.message);
    return {
      label: 'unknown',
      score: 0.5,
      confidence: 0.4
    };
  }
};

/**
 * Analyze a citizen reported problem
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.location
 * @param {string} [params.optionalCategory]
 * @param {string} [params.urgency]
 * @returns {Promise<Object>} AI analysis output
 */
const analyzeProblem = async ({ title = '', description = '', location = '', optionalCategory = '', urgency = 'MEDIUM' }) => {
  const combinedText = `${title} ${description}`.toLowerCase();

  // 1. Determine Category
  let detectedCategory = optionalCategory || '';
  let highestMatchCount = 0;
  let recommendedDept = 'District Municipal Administration';

  for (const [catName, data] of Object.entries(CIVIC_TAXONOMY)) {
    let matchCount = 0;
    for (const kw of data.keywords) {
      if (combinedText.includes(kw)) {
        matchCount++;
      }
    }
    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      detectedCategory = catName;
      recommendedDept = data.department;
    }
  }

  if (!detectedCategory) {
    detectedCategory = 'Infrastructure';
    recommendedDept = CIVIC_TAXONOMY['Infrastructure'].department;
  }

  // 2. Determine Severity independently based on impact, hazard keywords, and urgency
  let calculatedSeverity = 'MEDIUM';
  const criticalKeywords = ['arsenic', 'poison', 'collapse', 'death', 'casualty', 'hazard', 'severe', 'epidemic', 'dengue', 'flood', 'electrocution', 'accident', 'stopped for hundreds', 'stopped for 500'];
  const highKeywords = ['overflow', 'blocked', 'broken', 'contaminated', 'unsafe', 'school', 'hospital', 'major', 'deep pothole', 'water supply has stopped', 'supply stopped'];

  if (criticalKeywords.some(kw => combinedText.includes(kw)) || urgency === 'CRITICAL') {
    calculatedSeverity = 'CRITICAL';
  } else if (highKeywords.some(kw => combinedText.includes(kw)) || urgency === 'HIGH') {
    calculatedSeverity = 'HIGH';
  } else if (urgency === 'LOW') {
    calculatedSeverity = 'LOW';
  }

  // 3. Priority Recommendation
  let priorityRecommendation = 'MEDIUM';
  if (calculatedSeverity === 'CRITICAL' || calculatedSeverity === 'HIGH') {
    priorityRecommendation = calculatedSeverity;
  } else if (urgency === 'HIGH') {
    priorityRecommendation = 'HIGH';
  }

  // 4. Run Sentiment Analysis (Supporting signal)
  const sentimentResult = analyzeSentiment(`${title} ${description}`);

  // 5. Extract Keywords
  const words = combinedText
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'there', 'their', 'problem', 'issue', 'please', 'help', 'area', 'near'].includes(w));
  const uniqueKeywords = Array.from(new Set(words)).slice(0, 6);

  // 6. Generate Concise Summary
  const summary = `${detectedCategory} issue reported at ${location || 'local jurisdiction'}: "${title.trim()}". Classified with ${calculatedSeverity.toLowerCase()} severity due to community impact and infrastructure vulnerability. Tone detected as ${sentimentResult.label}.`;

  // 7. Similarity Search Query
  const similarityQuery = `${detectedCategory} ${location} ${uniqueKeywords.slice(0, 3).join(' ')}`.trim();

  return {
    category: detectedCategory,
    severity: calculatedSeverity,
    urgency: urgency || 'MEDIUM',
    priorityRecommendation,
    sentiment: sentimentResult,
    summary,
    keywords: uniqueKeywords,
    departmentRecommendation: recommendedDept,
    similarityQuery,
    confidenceScore: highestMatchCount > 0 ? 0.92 : 0.78,
    analyzedAt: new Date()
  };
};

module.exports = {
  analyzeProblem,
  analyzeSentiment
};
