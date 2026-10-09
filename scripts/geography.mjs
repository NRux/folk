export const REGIONS=Object.freeze({'north-america':'N. America','central-america':'C. America','south-america':'S. America',africa:'Africa',asia:'Asia',europe:'Europe',oceania:'Oceania'});
export const COUNTRIES=Object.freeze({
 'united-states':{name:'United States',region:'north-america'},
 mexico:{name:'Mexico',region:'north-america'},
 portugal:{name:'Portugal',region:'europe'},spain:{name:'Spain',region:'europe'},
 ghana:{name:'Ghana',region:'africa'},'south-korea':{name:'South Korea',region:'asia'},
 tajikistan:{name:'Tajikistan',region:'asia'},japan:{name:'Japan',region:'asia'},
 'new-zealand':{name:'New Zealand',region:'oceania'}
});
export function validateGeography(article){
 const country=Object.hasOwn(COUNTRIES,article.countrySlug)?COUNTRIES[article.countrySlug]:null;
 if(!country||article.regionSlug!==country.region)throw Error('Missing or inconsistent article country/region');
 return country;
}
