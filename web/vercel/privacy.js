(()=>{
 const key='folkly-privacy-v1',version=1,ttl=180*86400000,id='G-RQJD3XG35C';
 const el=id=>document.getElementById(id),panel=el('privacy-panel');if(!panel)return;
 let choice=null,loaded=false,opener=null;
 try{const raw=localStorage.getItem(key);if(raw&&raw.length<1000){const value=JSON.parse(raw);if(value.version===version&&typeof value.analytics==='boolean'&&Number.isFinite(value.at)&&value.at<=Date.now()&&Date.now()-value.at<ttl)choice=value;}}catch{}
 window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
 const denied={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
 window.gtag('consent','default',denied);
 function analytics(){if(loaded)return;loaded=true;window.gtag('consent','update',{...denied,analytics_storage:'granted'});window.gtag('js',new Date());window.gtag('config',id,{allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname});const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.append(script);}
 function clearCookies(){for(const entry of document.cookie.split(';')){const name=entry.split('=')[0].trim();if(!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name))continue;const parts=location.hostname.split('.');for(const domain of ['',...parts.map((_,i)=>'.'+parts.slice(i).join('.'))])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}}
 function open(button){opener=button||document.activeElement;panel.hidden=false;el('privacy-analytics').checked=Boolean(choice?.analytics);el('privacy-title').focus();}
 function save(allow){const wasLoaded=loaded;choice={version,analytics:Boolean(allow),at:Date.now()};try{localStorage.setItem(key,JSON.stringify(choice));}catch{}panel.hidden=true;opener?.focus?.();if(choice.analytics)analytics();else{window.gtag('consent','update',denied);clearCookies();if(wasLoaded)location.reload();}}
 for(const button of document.querySelectorAll('[data-privacy-open]'))button.addEventListener('click',()=>open(button));
 el('privacy-accept').addEventListener('click',()=>save(true));el('privacy-reject').addEventListener('click',()=>save(false));el('privacy-save').addEventListener('click',()=>save(el('privacy-analytics').checked));el('privacy-manage').addEventListener('click',()=>{el('privacy-details').hidden=false;el('privacy-save').hidden=false;el('privacy-analytics').focus();});
 if(navigator.globalPrivacyControl===true)el('privacy-signal').textContent='Global Privacy Control detected. Advertising stays disabled; analytics is a separate optional choice.';
 if(choice?.analytics)analytics();if(!choice)open();
})();
