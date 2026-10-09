const geographyScores={
  'article-place':4,
  'nearby-place':3,
  'not-location':4,
  'outside-article':0
};
const subjectScores={
  'named-entity':4,
  'direct-practice':3,
  'story-infrastructure':3,
  'contextual-place':2,
  generic:0
};
const placementScores={
  'exact-pair':2,
  section:1,
  article:0,
  cover:2,
  none:0
};
const prominenceScores={primary:2,clear:1,incidental:0};

function civilDate(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value));
}

export function relevanceScore(review){
  const score=geographyScores[review.geography]+subjectScores[review.subject]+placementScores[review.placement]+prominenceScores[review.prominence];
  if(!Number.isSafeInteger(score))throw Error('Invalid image relevance scale');
  return score;
}

export function validateImageRelevance(review,{threshold,paragraphs,label}){
  if(!review||typeof review!=='object'||Array.isArray(review))throw Error(`Missing image relevance review: ${label}`);
  if(review.event!=='named-in-story'&&review.event!=='not-event')throw Error(`Unmentioned image event: ${label}`);
  if(review.geography==='outside-article')throw Error(`Image location is outside the article: ${label}`);
  if(review.prominence==='incidental')throw Error(`Claimed image subject is incidental: ${label}`);
  if(!Array.isArray(review.paragraphs)||review.paragraphs.length!==2||review.paragraphs.some(n=>!Number.isSafeInteger(n)||n<0))throw Error(`Invalid image placement review: ${label}`);
  if(review.paragraphs[0]!==paragraphs[0]||review.paragraphs[1]!==paragraphs[1])throw Error(`Image review does not match placement: ${label}`);
  if(typeof review.evidence!=='string'||!review.evidence.trim()||review.evidence.length>600||!civilDate(review.reviewedAt))throw Error(`Incomplete image relevance evidence: ${label}`);
  const score=relevanceScore(review);
  if(score<threshold)throw Error(`Image relevance below threshold: ${label} (${score}/${threshold})`);
  return score;
}

export function validateArticleImageRelevance(article,images,registry){
  if(!registry||registry.format!=='folkly-image-relevance-v1'||!Number.isSafeInteger(registry.threshold)||registry.threshold<1||registry.threshold>12||!civilDate(registry.enforcePublishedAfter)||!registry.articles||typeof registry.articles!=='object')throw Error('Invalid image relevance registry');
  const policy=registry.articles[article.slug];
  if(!policy){
    if(article.publishedAt>registry.enforcePublishedAfter)throw Error(`Missing image relevance policy: ${article.slug}`);
    return {state:'legacy'};
  }
  if(!article.image)throw Error(`Missing article cover image: ${article.slug}`);
  if(!Array.isArray(images)||!policy.reviews||typeof policy.reviews!=='object')throw Error(`Invalid article image relevance policy: ${article.slug}`);
  const expected=new Set(['cover',...images.map(image=>String(image.commonsPageId))]);
  const actual=new Set(Object.keys(policy.reviews));
  if(expected.size!==actual.size||[...expected].some(key=>!actual.has(key)))throw Error(`Image relevance manifest mismatch: ${article.slug}`);
  const cover=policy.reviews.cover;
  if(cover.commonsPageId!==policy.coverCommonsPageId||article.image.source!==policy.coverSource){
    throw Error(`Cover relevance identity mismatch: ${article.slug}`);
  }
  const scores=[validateImageRelevance(cover,{threshold:registry.threshold,paragraphs:[0,0],label:`${article.slug}:cover`})];
  images.forEach((image,index)=>{
    const review=policy.reviews[String(image.commonsPageId)];
    if(review.commonsPageId!==image.commonsPageId)throw Error(`Image relevance identity mismatch: ${article.slug}:${image.commonsPageId}`);
    scores.push(validateImageRelevance(review,{threshold:registry.threshold,paragraphs:[index*2+1,index*2+2],label:`${article.slug}:${image.commonsPageId}`}));
  });
  return {state:'accepted',minimum:Math.min(...scores),scores};
}
