// Bounded editorial telemetry. Consent is checked at emission time by privacy.js.
export const milestones=[25,50,75,90];
const slug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=120;
export function readerIdentity(article,location){
  if(!article||!['https://www.folkly.com','https://folkly.com'].includes(location.origin))return null;
  const id=article.dataset.articleId,version=article.dataset.articleVersion,path=location.pathname.replace(/\.html$/,'');
  if(!slug(id)||! /^[a-f0-9]{64}$/.test(version)||!new RegExp(`^/(?:zh-Hans/|es/|hi/|ar/|fr/|ja/)?${id}$`).test(path))return null;
  return {article_id:id,content_version:version};
}
export function targetStory(href,origin,allowed){
  try{const url=new URL(href,origin),id=url.pathname.replace(/\.html$/,'').split('/').at(-1);return url.origin===origin&&!url.username&&!url.password&&slug(id)&&allowed.has(id)?id:null;}catch{return null;}
}
export function readingTracker(identity,emit){
  const sent=new Set();
  return {depth(percent){for(const depth of milestones)if(Number.isFinite(percent)&&percent>=depth&&!sent.has(depth)){sent.add(depth);emit('article_read_depth',{...identity,read_depth:depth});}},sent};
}
export function bootReader(document,window,location){
  const article=document.querySelector('article[data-article-id]'),identity=readerIdentity(article,location),body=article?.querySelector('.article-body');
  if(!identity||!body)return;
  const emit=(name,data)=>window.folklyAnalytics?.emit(name,data)===true,tracker=readingTracker(identity,emit);
  const related=[...document.querySelectorAll('.related-stories a.related-card[data-story-id]')],allowed=new Set(related.map(a=>a.dataset.storyId).filter(slug));
  let scheduled=false;
  window.addEventListener('scroll',()=>{if(scheduled)return;scheduled=true;window.requestAnimationFrame(()=>{scheduled=false;if(document.visibilityState==='hidden')return;const rect=body.getBoundingClientRect();if(rect.height>0)tracker.depth(Math.max(0,Math.min(100,(window.innerHeight-rect.top)/rect.height*100)));});},{passive:true});
  document.addEventListener('click',event=>{
    const anchor=event.target?.closest?.('a');if(!anchor||!anchor.closest)return;
    if(anchor.closest('.related-stories')){const id=targetStory(anchor.href,location.origin,allowed);if(id)emit('related_story_click',{...identity,target_article_id:id});}
    else if(anchor.closest('.music-examples'))emit('music_example_click',identity);
  });
}
if(typeof document!=='undefined'&&typeof window!=='undefined')bootReader(document,window,location);
