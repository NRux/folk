import {createNewsletterRecoveryHandler} from '../server/newsletter-recovery.js';
// Administrative single-use storage fixture only. No grant issuance or mail action.
const handler=createNewsletterRecoveryHandler();
export const GET=handler;
export const POST=handler;
