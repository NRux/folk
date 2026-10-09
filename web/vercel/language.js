(()=>{try{
// Language dropdown: persist the reader's explicit choice, and follow it across
// pages by navigating to the stored locale when this page serves one (the menu
// only ever links to locales with an approved translation of the current page).
const links=[].slice.call(document.querySelectorAll('.language-menu a[hreflang],.language-switcher a[hreflang]'));
links.forEach(link=>link.addEventListener('click',()=>{try{localStorage.setItem('folkly-language',link.getAttribute('hreflang'));}catch{}}));
let stored=null;try{stored=localStorage.getItem('folkly-language');}catch{}
if(stored&&stored!==document.documentElement.lang){
  const target=links.find(link=>link.getAttribute('hreflang')===stored);
  if(target)location.assign(target.getAttribute('href'));
}
}catch{}})();
