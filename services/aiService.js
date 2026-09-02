/**
 * SolveLink AI Service
 * Isolated server-side AI reasoning engine for problem categorization,
 * sentiment analysis, severity estimation, priority recommendation, and keyword extraction.
 * 
 * Rules:
 * - AI answers: "WHAT TYPE OF PROBLEM IS THIS?"
 * - Outputs structured classification contract: { domain, category, subCategory, urgency, confidence }
 * - Never directly assigns an authority user (that is the matching engine's job).
 * - Deterministic fallback guarantees 100% uptime with zero external network dependencies.
 */

/**
 * Canonical Structured Civic Taxonomy
 * Maps normalized domain keys to human display names, keywords, subcategories, and departments.
 */
const CIVIC_SECTORS = [
  { key: 'water_sanitation', label: 'Water & Sanitation' },
  { key: 'public_works_infrastructure', label: 'Public Works & Infrastructure' },
  { key: 'public_health', label: 'Public Health' },
  { key: 'agriculture', label: 'Agriculture' },
  { key: 'energy', label: 'Energy' },
  { key: 'waste_management', label: 'Waste Management' },
  { key: 'education', label: 'Education' },
  { key: 'digital_governance_it', label: 'Digital Governance & IT' },
  { key: 'environment_forest', label: 'Environment & Forest' },
  { key: 'transport', label: 'Transport' },
  { key: 'urban_development', label: 'Urban Development' },
  { key: 'rural_development', label: 'Rural Development' },
  { key: 'public_safety', label: 'Public Safety' },
  { key: 'municipal_corporation', label: 'Municipal Corporation' },
  { key: 'other', label: 'Other' }
];

const CIVIC_TAXONOMY = {
  water_sanitation: {
    label: 'Water & Sanitation',
    keywords: [
      'water', 'pipe', 'pipeline', 'leak', 'leaking', 'leakage', 'drainage', 'sewage',
      'sewer', 'borewell', 'arsenic', 'drinking water', 'contamination', 'tap', 'well',
      'overflow', 'gutter', 'sanitation', 'manhole', 'waterlogging', 'jal', 'filtration',
      'handpump', 'submersible', 'burst pipe', 'dirty water'
    ],
    defaultDepartment: 'Department of Drinking Water & Sanitation / Municipal Water Supply Board',
    defaultSeverity: 'HIGH'
  },
  public_works_infrastructure: {
    label: 'Public Works & Infrastructure',
    keywords: [
      'road', 'pothole', 'potholes', 'bridge', 'culvert', 'pavement', 'street',
      'crack', 'cracks', 'asphalt', 'divider', 'traffic light', 'streetlight',
      'streetlights', 'footpath', 'collapse', 'sidewalk', 'flyover', 'tarmac',
      'highway', 'drain slab', 'cave-in', 'sinkhole'
    ],
    defaultDepartment: 'Public Works Department (PWD) / Urban Local Body Roads Wing',
    defaultSeverity: 'MEDIUM'
  },
  public_health: {
    label: 'Public Health',
    keywords: [
      'hospital', 'clinic', 'asha', 'medicine', 'phc', 'doctor', 'ambulance',
      'disease', 'dengue', 'malaria', 'vaccine', 'health', 'fever', 'medical',
      'epidemic', 'infection', 'poisoning', 'subcenter', 'health worker', 'pharmacy'
    ],
    defaultDepartment: 'Department of Health & Family Welfare / District Health Society',
    defaultSeverity: 'CRITICAL'
  },
  agriculture: {
    label: 'Agriculture',
    keywords: [
      'crop', 'farmer', 'farmers', 'irrigation', 'canal', 'harvest', 'paddy',
      'wheat', 'fertilizer', 'soil', 'pesticide', 'farming', 'produce', 'field',
      'kisan', 'drought', 'mandi', 'cold storage', 'seed', 'agro'
    ],
    defaultDepartment: 'Department of Agriculture & Farmers Welfare',
    defaultSeverity: 'MEDIUM'
  },
  energy: {
    label: 'Energy',
    keywords: [
      'electricity', 'power outage', 'power cut', 'blackout', 'transformer',
      'hanging wire', 'electric pole', 'solar', 'grid', 'voltage', 'short circuit',
      'current', 'bijli', 'transmission', 'meter', 'loose wire', 'electrocution'
    ],
    defaultDepartment: 'State Electricity Distribution Company / Renewable Energy Agency',
    defaultSeverity: 'HIGH'
  },
  waste_management: {
    label: 'Waste Management',
    keywords: [
      'garbage', 'waste', 'dump', 'dumpyard', 'trash', 'plastic', 'landfill',
      'litter', 'debris', 'solid waste', 'stench', 'uncollected', 'kachra',
      'compost', 'recycling', 'garbage bin'
    ],
    defaultDepartment: 'Municipal Solid Waste Management Directorate',
    defaultSeverity: 'MEDIUM'
  },
  education: {
    label: 'Education',
    keywords: [
      'school', 'classroom', 'student', 'students', 'teacher', 'teachers',
      'blackboard', 'benches', 'library', 'learning', 'college', 'midday meal',
      'school building', 'toilets in school'
    ],
    defaultDepartment: 'Department of School Education & Literacy',
    defaultSeverity: 'LOW'
  },
  digital_governance_it: {
    label: 'Digital Governance & IT',
    keywords: [
      'internet', 'connectivity', 'broadband', 'csc', 'portal', 'server',
      'wifi', 'telecom', 'optical fiber', 'digital', 'network', 'biometric', 'aadhaar'
    ],
    defaultDepartment: 'Department of Information Technology & Digital Governance',
    defaultSeverity: 'LOW'
  },
  environment_forest: {
    label: 'Environment & Forest',
    keywords: [
      'forest', 'tree', 'wildlife', 'air pollution', 'smoke', 'river pollution',
      'mining dust', 'deforestation', 'cutting trees', 'wild animals', 'lake pollution'
    ],
    defaultDepartment: 'Department of Forest, Environment & Climate Change',
    defaultSeverity: 'MEDIUM'
  },
  transport: {
    label: 'Transport',
    keywords: [
      'bus', 'transit', 'traffic', 'speed breaker', 'parking', 'transport',
      'pedestrian crossing', 'auto stand', 'bus stop', 'overcrowded bus'
    ],
    defaultDepartment: 'Department of Transport / Regional Transport Authority',
    defaultSeverity: 'MEDIUM'
  },
  urban_development: {
    label: 'Urban Development',
    keywords: [
      'urban', 'encroachment', 'park', 'community center', 'slum',
      'town planning', 'building violation', 'drainage master plan'
    ],
    defaultDepartment: 'Urban Development & Housing Department',
    defaultSeverity: 'MEDIUM'
  },
  rural_development: {
    label: 'Rural Development',
    keywords: [
      'panchayat', 'gram sabha', 'rural road', 'village hall', 'mgnrega',
      'rural scheme', 'panchayat bhawan'
    ],
    defaultDepartment: 'Department of Rural Development',
    defaultSeverity: 'MEDIUM'
  },
  public_safety: {
    label: 'Public Safety',
    keywords: [
      'fire hazard', 'flood', 'building collapse', 'landslide', 'disaster',
      'gas leak', 'illegal construction danger', 'hazard'
    ],
    defaultDepartment: 'Disaster Management & District Civil Administration',
    defaultSeverity: 'CRITICAL'
  }
};

/**
 * Civic & Emotional Sentiment Lexicon
 */
const SENTIMENT_LEXICON = {
  'frustrated': -3.5,
  'frustrating': -3.2,
  'terrible': -3.8,
  'horrible': -3.8,
  'worst': -4.0,
  'disaster': -3.5,
  'crisis': -3.4,
  'unbearable': -3.7,
  'negligence': -3.4,
  'suffering': -3.5,
  'damaged': -2.2,
  'broken': -2.0,
  'danger': -2.8,
  'dangerous': -2.8,
  'hazard': -2.6,
  'hazardous': -2.6,
  'dirty': -2.0,
  'leak': -1.8,
  'leaking': -1.8,
  'leakage': -1.8,
  'pothole': -1.6,
  'potholes': -1.6,
  'overflow': -1.8,
  'overflowing': -2.0,
  'unsafe': -2.6,
  'waterlogging': -2.0,
  'excellent': 3.8,
  'appreciated': 3.2,
  'good': 2.0,
  'resolved': 2.6,
  'fixed': 2.4,
  'clean': 2.2,
  'safe': 2.4
};

const NEGATIONS = new Set(['not', 'no', 'never', 'hardly', 'barely', 'without', 'lack']);

/**
 * Lightweight local server-side NLP sentiment analyzer
 */
const analyzeSentiment = (text = '') => {
  try {
    if (!text || typeof text !== 'string') {
      return { label: 'neutral', score: 0.5, confidence: 0.5 };
    }

    const tokens = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    if (tokens.length === 0) return { label: 'neutral', score: 0.5, confidence: 0.5 };

    let totalScore = 0;
    let matchedCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (SENTIMENT_LEXICON[token] !== undefined) {
        let val = SENTIMENT_LEXICON[token];
        if (i > 0 && NEGATIONS.has(tokens[i - 1])) {
          val = -val * 0.8;
        }
        totalScore += val;
        matchedCount++;
      }
    }

    let normalizedScore = 0.50;
    if (matchedCount > 0) {
      const comparative = totalScore / (Math.sqrt(tokens.length) + 1.5);
      normalizedScore = 0.50 + 0.50 * Math.tanh(comparative / 2.5);
      normalizedScore = Math.max(0, Math.min(1, Math.round(normalizedScore * 100) / 100));
    }

    let label = 'neutral';
    if (normalizedScore <= 0.42) label = 'negative';
    else if (normalizedScore >= 0.58) label = 'positive';

    return {
      label,
      score: normalizedScore,
      confidence: matchedCount > 0 ? Math.min(0.95, 0.70 + (matchedCount * 0.05)) : 0.60
    };
  } catch (error) {
    return { label: 'unknown', score: 0.5, confidence: 0.4 };
  }
};

/**
 * Extract fine-grained category & subCategory within a detected domain
 */
function resolveSubCategory(domainKey, text) {
  const t = text.toLowerCase();

  switch (domainKey) {
    case 'water_sanitation':
      if (t.includes('leak') || t.includes('burst') || t.includes('pipe') || t.includes('pipeline')) {
        return { category: 'water_leakage', subCategory: 'pipeline_leak' };
      }
      if (t.includes('drain') || t.includes('overflow') || t.includes('gutter') || t.includes('waterlogging')) {
        return { category: 'drainage_overflow', subCategory: 'clogged_drain' };
      }
      if (t.includes('arsenic') || t.includes('contaminat') || t.includes('dirty') || t.includes('poison') || t.includes('smell')) {
        return { category: 'water_contamination', subCategory: 'drinking_water_contamination' };
      }
      if (t.includes('sewer') || t.includes('manhole') || t.includes('sewage')) {
        return { category: 'sewerage_blockage', subCategory: 'manhole_overflow' };
      }
      return { category: 'water_supply', subCategory: 'irregular_supply' };

    case 'public_works_infrastructure':
      if (t.includes('pothole') || t.includes('road') || t.includes('asphalt') || t.includes('tarmac')) {
        return { category: 'road_damage', subCategory: 'pothole_cluster' };
      }
      if (t.includes('bridge') || t.includes('culvert') || t.includes('flyover')) {
        return { category: 'bridge_culvert', subCategory: 'culvert_collapse' };
      }
      if (t.includes('light') || t.includes('lamp') || t.includes('dark')) {
        return { category: 'street_lighting', subCategory: 'broken_streetlight' };
      }
      if (t.includes('footpath') || t.includes('pavement') || t.includes('sidewalk')) {
        return { category: 'footpath_damage', subCategory: 'broken_pavers' };
      }
      return { category: 'public_infrastructure', subCategory: 'structural_defect' };

    case 'public_health':
      if (t.includes('dengue') || t.includes('malaria') || t.includes('fever') || t.includes('epidemic')) {
        return { category: 'disease_outbreak', subCategory: 'vector_borne_cluster' };
      }
      if (t.includes('hospital') || t.includes('phc') || t.includes('doctor') || t.includes('medicine')) {
        return { category: 'healthcare_facilities', subCategory: 'phc_amenities' };
      }
      return { category: 'public_health_hazard', subCategory: 'community_hygiene' };

    case 'agriculture':
      if (t.includes('irrigation') || t.includes('canal') || t.includes('pump')) {
        return { category: 'irrigation_issues', subCategory: 'canal_breach' };
      }
      if (t.includes('crop') || t.includes('pest') || t.includes('harvest')) {
        return { category: 'crop_damage', subCategory: 'crop_loss' };
      }
      if (t.includes('storage') || t.includes('cold storage')) {
        return { category: 'storage_logistics', subCategory: 'cold_storage_lack' };
      }
      return { category: 'agricultural_infrastructure', subCategory: 'farm_support' };

    case 'energy':
      if (t.includes('transformer') || t.includes('outage') || t.includes('blackout')) {
        return { category: 'power_outage', subCategory: 'transformer_failure' };
      }
      if (t.includes('wire') || t.includes('pole') || t.includes('shock') || t.includes('hazard')) {
        return { category: 'electrical_hazard', subCategory: 'hanging_wire' };
      }
      if (t.includes('solar') || t.includes('inverter')) {
        return { category: 'renewable_energy', subCategory: 'solar_microgrid' };
      }
      return { category: 'electricity_supply', subCategory: 'voltage_fluctuation' };

    case 'waste_management':
      if (t.includes('plastic')) {
        return { category: 'plastic_waste', subCategory: 'plastic_accumulation' };
      }
      return { category: 'garbage_dumping', subCategory: 'uncollected_garbage' };

    case 'education':
      if (t.includes('computer') || t.includes('internet') || t.includes('digital')) {
        return { category: 'digital_lab', subCategory: 'lab_malfunction' };
      }
      return { category: 'school_infrastructure', subCategory: 'classroom_dilapidation' };

    case 'digital_governance_it':
      return { category: 'connectivity_loss', subCategory: 'broadband_outage' };

    case 'transport':
      return { category: 'public_transit', subCategory: 'transit_disruption' };

    default:
      return { category: 'general_civic', subCategory: 'civic_defect' };
  }
}

/**
 * Main AI Problem Classification Function
 * Produces structured classification: { domain, category, subCategory, urgency, confidence }
 * 
 * @param {Object} params
 * @param {string} params.title - Citizen problem summary
 * @param {string} params.description - Citizen detailed description
 * @param {string} params.location - Location or landmark
 * @param {string} [params.optionalCategory] - Optional user hint (if any)
 * @param {string} [params.urgency] - Optional user urgency assessment
 * @returns {Promise<Object>} Structured classification result
 */
const analyzeProblem = async ({
  title = '',
  description = '',
  location = '',
  optionalCategory = '',
  urgency = 'MEDIUM'
}) => {
  const combinedText = `${title} ${description}`.toLowerCase();

  // 1. Match Domain using Deterministic Keyword Scoring
  let bestDomainKey = 'public_works_infrastructure'; // baseline fallback
  let highestMatchCount = 0;

  for (const [key, data] of Object.entries(CIVIC_TAXONOMY)) {
    let matches = 0;
    for (const kw of data.keywords) {
      if (combinedText.includes(kw)) {
        matches++;
      }
    }
    if (matches > highestMatchCount) {
      highestMatchCount = matches;
      bestDomainKey = key;
    }
  }

  // If user provided a category hint that matches a known domain, give it weight if ambiguous
  if (highestMatchCount === 0 && optionalCategory) {
    const hintNorm = optionalCategory.toLowerCase().replace(/[^\w]/g, '_');
    if (CIVIC_TAXONOMY[hintNorm]) {
      bestDomainKey = hintNorm;
    } else {
      const match = CIVIC_SECTORS.find(s => s.label.toLowerCase() === optionalCategory.toLowerCase());
      if (match) bestDomainKey = match.key;
    }
  }

  const domainData = CIVIC_TAXONOMY[bestDomainKey] || CIVIC_TAXONOMY.public_works_infrastructure;

  // 2. Resolve specific category & subCategory
  const { category, subCategory } = resolveSubCategory(bestDomainKey, combinedText);

  // 3. Determine Urgency & Severity
  let calculatedUrgency = urgency ? urgency.toUpperCase() : 'MEDIUM';
  const criticalWords = ['arsenic', 'poison', 'collapse', 'death', 'casualty', 'hazard', 'severe', 'epidemic', 'dengue', 'flood', 'electrocution', 'accident', 'burst'];
  const highWords = ['overflow', 'blocked', 'broken', 'contaminated', 'unsafe', 'school', 'hospital', 'major', 'deep pothole', 'leaking heavily', 'stopped'];

  if (criticalWords.some(w => combinedText.includes(w)) || urgency === 'CRITICAL') {
    calculatedUrgency = 'CRITICAL';
  } else if (highWords.some(w => combinedText.includes(w)) || urgency === 'HIGH') {
    calculatedUrgency = 'HIGH';
  } else if (urgency === 'LOW') {
    calculatedUrgency = 'LOW';
  }

  // 4. Calculate Confidence (0.75 - 0.96)
  let confidence = 0.80;
  if (highestMatchCount >= 3) confidence = 0.94;
  else if (highestMatchCount === 2) confidence = 0.89;
  else if (highestMatchCount === 1) confidence = 0.82;
  else confidence = 0.75;

  // 5. Sentiment Analysis
  const sentimentResult = analyzeSentiment(`${title} ${description}`);

  // 6. Keywords Extraction
  const words = combinedText
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'there', 'their', 'problem', 'issue', 'please', 'help', 'area', 'near', 'causing'].includes(w));
  const uniqueKeywords = Array.from(new Set(words)).slice(0, 6);

  // 7. Concise Summary
  const summary = `${domainData.label} issue reported at ${location || 'local jurisdiction'}: "${title.trim()}". Identified as ${category.replace(/_/g, ' ')} (${subCategory.replace(/_/g, ' ')}). Priority: ${calculatedUrgency}.`;

  return {
    // Structured Contract for Authority Routing & Database
    domain: bestDomainKey,
    category,
    subCategory,
    urgency: calculatedUrgency,
    confidence,

    // Legacy & Display Compatibility Fields
    humanCategory: domainData.label,
    departmentRecommendation: domainData.defaultDepartment,
    severity: calculatedUrgency,
    priorityRecommendation: calculatedUrgency,
    sentiment: sentimentResult,
    summary,
    keywords: uniqueKeywords,
    confidenceScore: confidence,
    analyzedAt: new Date()
  };
};

module.exports = {
  analyzeProblem,
  analyzeSentiment,
  CIVIC_SECTORS,
  CIVIC_TAXONOMY
};
