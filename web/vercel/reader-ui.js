(()=>{
 let data;try{data=JSON.parse(document.getElementById('folkly-reader-ui')?.textContent||'null');}catch{}
 if(!data||!['zh-Hans','es','hi','ar','fr','ja'].includes(data.locale)||!data.strings||typeof data.strings!=='object'||Array.isArray(data.strings))return;
 window.FolklyUI=Object.freeze({t(key,fallback){const value=Object.hasOwn(data.strings,key)?data.strings[key]:null;return typeof value==='string'&&value.trim()&&value.length<=30000?value:fallback;}});
})();
