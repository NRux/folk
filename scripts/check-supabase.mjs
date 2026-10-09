import { readEditorialSettings } from '../server/supabase.js';
const settings = await readEditorialSettings();
for (const key of ['production.autonomous_enabled', 'publication.autonomous_enabled', 'schedule.enabled']) {
  if (settings[key] !== 'false') throw new Error('Editorial activation state is not safely paused');
}
console.log('Supabase query succeeded; all editorial activation switches are off.');
