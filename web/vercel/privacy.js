(()=>{
 const key='folkly-privacy-v1',version=1,ttl=180*86400000,id='G-RQJD3XG35C';
 const el=id=>document.getElementById(id),panel=el('privacy-panel');if(!panel)return;
 let choice=null,loaded=false,allowed=false,opener=null;
 try{const raw=localStorage.getItem(key);if(raw&&raw.length<1000){const value=JSON.parse(raw);if(value.version===version&&typeof value.analytics==='boolean'&&Number.isFinite(value.at)&&value.at<=Date.now()&&Date.now()-value.at<ttl)choice=value;}}catch{}
 window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
 const denied={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
 window.gtag('consent','default',denied);
 const events={article_read_depth:['article_id','content_version','read_depth'],related_story_click:['article_id','content_version','target_article_id'],music_example_click:['article_id','content_version'],subscribe_success:[]};
 window.folklyAnalytics=Object.freeze({emit(name,data={}){
   if(!allowed||!['https://www.folkly.com','https://folkly.com'].includes(location.origin)||!Object.hasOwn(events,name)||!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).sort().join('|')!==events[name].slice().sort().join('|'))return false;
   for(const [k,v] of Object.entries(data))if(k==='read_depth'?![25,50,75,90].includes(v):k==='content_version'?!/^[a-f0-9]{64}$/.test(v):typeof v!=='string'||v.length>120||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))return false;
   window.gtag('event',name,{...data,page_location:location.origin+location.pathname.replace(/\.html$/,'')});return true;
 }});
 function analytics(){if(!['https://www.folkly.com','https://folkly.com'].includes(location.origin))return;allowed=true;if(loaded)return;loaded=true;let referrer='';try{const ref=new URL(document.referrer);if(['https:','http:'].includes(ref.protocol))referrer=ref.origin+ref.pathname;}catch{}window.gtag('consent','update',{...denied,analytics_storage:'granted'});window.gtag('js',new Date());window.gtag('config',id,{allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname.replace(/\.html$/,''),page_referrer:referrer});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.append(script);}
 function clearCookies(){for(const entry of document.cookie.split(';')){const name=entry.split('=')[0].trim();if(!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name))continue;const parts=location.hostname.split('.');for(const domain of ['',...parts.map((_,i)=>'.'+parts.slice(i).join('.'))])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}}
 function open(button){opener=button||document.activeElement;panel.hidden=false;el('privacy-analytics').checked=Boolean(choice?.analytics);el('privacy-title').focus();}
 function save(allow){const wasLoaded=loaded;choice={version,analytics:Boolean(allow),at:Date.now()};try{localStorage.setItem(key,JSON.stringify(choice));}catch{}panel.hidden=true;opener?.focus?.();if(choice.analytics)analytics();else{allowed=false;window.gtag('consent','update',denied);clearCookies();if(wasLoaded)location.reload();}}
 for(const button of document.querySelectorAll('[data-privacy-open]'))button.addEventListener('click',()=>open(button));
 el('privacy-accept').addEventListener('click',()=>save(true));el('privacy-reject').addEventListener('click',()=>save(false));el('privacy-save').addEventListener('click',()=>save(el('privacy-analytics').checked));el('privacy-manage').addEventListener('click',()=>{el('privacy-details').hidden=false;el('privacy-save').hidden=false;el('privacy-analytics').focus();});
 if(navigator.globalPrivacyControl===true)el('privacy-signal').textContent=window.FolklyUI?.t('gpc','Global Privacy Control detected. Advertising stays disabled; analytics is a separate optional choice.')||'Global Privacy Control detected. Advertising stays disabled; analytics is a separate optional choice.';
 if(choice?.analytics)analytics();if(!choice)open();
})();
