function inferGenderFromGroup(input) {
  const text = typeof input === 'string'
    ? input
    : [input?.gender_group, input?.board_class, input?.team_name].filter(Boolean).join(' ');
  const compact = String(text || '').replace(/\s+/g, '');
  if (!compact) return 'unknown';
  if (/混合|无差别|家庭|双人|龙板|接力/.test(compact)) return 'mixed';
  const hasMale = /男子|男/.test(compact);
  const hasFemale = /女子|女/.test(compact);
  if (hasMale && !hasFemale) return 'male';
  if (hasFemale && !hasMale) return 'female';
  return 'unknown';
}

function inferGenderFromVotes(votes) {
  const male = votes.male || 0;
  const female = votes.female || 0;
  const mixed = votes.mixed || 0;
  const known = male + female + mixed;
  if (known <= 0) return { gender: 'unknown', confidence: 0 };
  const candidates = [['male', male], ['female', female], ['mixed', mixed]].sort((a, b) => b[1] - a[1]);
  const [topGender, topCount] = candidates[0];
  const secondCount = candidates[1][1];
  const confidence = Number((topCount / known).toFixed(3));
  if (topCount === 0) return { gender: 'unknown', confidence: 0 };
  if (topGender === 'mixed') return confidence >= 0.8 ? { gender: 'mixed', confidence } : { gender: 'unknown', confidence };
  if (secondCount === 0 || confidence >= 0.8) return { gender: topGender, confidence };
  return { gender: 'unknown', confidence };
}

module.exports = { inferGenderFromGroup, inferGenderFromVotes };
