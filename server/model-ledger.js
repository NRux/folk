import { publisherClient } from './publisher.js';
import { generateDraft } from './model-provider.js';

// Use an immutable UUID for each attempt. Replaying it cannot start another call.
export function modelLedger(jobId, client = publisherClient()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId || '')) throw Error('Immutable job UUID required');
  return {
    async reserveBudget({ model, maxDollars }) {
      const { data, error } = await client.rpc('folkly_reserve_model_budget', { job_key: jobId, model_id: model, max_dollars: maxDollars });
      if (error) throw Error('Model budget reservation unavailable');
      return data;
    },
    async recordUsage({ reservation, model, modelSnapshot, status, usage }) {
      // Persist only bounded metadata, never prompts, article text or credentials.
      const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
      const evidence = { model, modelSnapshot: String(modelSnapshot).slice(0,120), inputTokens: count(usage?.inputTokens), outputTokens: count(usage?.outputTokens), totalTokens: count(usage?.totalTokens) };
      const { data, error } = await client.rpc('folkly_record_model_usage', { job_key: jobId, reservation_token: reservation.id, outcome: status, usage_evidence: evidence });
      if (error || data !== true) throw Error('Model usage persistence unavailable; reservation retained');
    },
  };
}
export async function generateBudgetedDraft({ jobId, ...params }, env = process.env, generate) {
  if (params.settings?.['production.autonomous_enabled'] !== 'true') throw Error('Generation is paused');
  const ledger = modelLedger(jobId, publisherClient(env));
  return generateDraft({ ...params, ...ledger }, env, generate);
}
