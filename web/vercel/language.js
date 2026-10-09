(()=>{document.querySelectorAll('.language-switcher a').forEach(link=>link.addEventListener('click',()=>{try{localStorage.setItem('folkly-language',link.getAttribute('hreflang'));}catch{}}));})();
