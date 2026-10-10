// Shared by the delivery worker and read-only owner readiness. Values never form
// part of the readiness response; only these fixed variable names can be returned.
export function newsletterConfigFromEnv(env=process.env) {
 return {enabled:env.NEWSLETTER_ENABLED==='true',cronSecret:env.CRON_SECRET,apiKey:env.RESEND_API_KEY,from:env.NEWSLETTER_FROM,postalAddress:env.NEWSLETTER_POSTAL_ADDRESS,secret:env.NEWSLETTER_SECRET,storage:Boolean(env.BLOB_STORE_ID||env.BLOB_READ_WRITE_TOKEN)};
}
export function newsletterMissingConfig(cfg) {
 const present=value=>typeof value==='string'&&value.trim().length>0;
 const checks=[
  ['CRON_SECRET',present(cfg.cronSecret)&&!/[\r\n]/.test(cfg.cronSecret)],
  ['RESEND_API_KEY',present(cfg.apiKey)],
  ['NEWSLETTER_FROM',present(cfg.from)&&!/[\r\n]/.test(cfg.from)],
  ['NEWSLETTER_POSTAL_ADDRESS',present(cfg.postalAddress)],
  ['NEWSLETTER_SECRET',typeof cfg.secret==='string'&&cfg.secret.length>=32],
  ['PRIVATE_BLOB_CONNECTION',cfg.storage===true],
 ];
 return checks.filter(([,ok])=>!ok).map(([name])=>name);
}
