import {readNewsletterCatalog} from '../server/newsletter-catalog.js';
import {newsletterConfigFromEnv} from '../server/newsletter-config.js';
import {createNewsletterHandler} from '../server/newsletter.js';
import {newsletterStore} from '../server/newsletter-store.js';
import {createResendSender} from '../server/resend.js';
export const config={maxDuration:300};
export const GET=createNewsletterHandler({
 config:()=>newsletterConfigFromEnv(),
 catalog:readNewsletterCatalog,
 store:newsletterStore,
 send:createResendSender()
});
