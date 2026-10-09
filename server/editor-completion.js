// Completion tokens include invisible reasoning. Keep the existing $0.15
// attempt reservation and leave headroom for a concise visible answer.
export const EDITOR_COMPLETION_LIMIT=2048;
const finishes=new Set(['stop','length','content-filter','tool-calls','error','other']);
export function editorCompletionDiagnostics(value){
 const result={finishReason:finishes.has(value?.finishReason)?value.finishReason:'unknown',maxCompletionTokens:EDITOR_COMPLETION_LIMIT};
 for(const key of ['inputTokens','outputTokens','reasoningTokens'])if(Number.isSafeInteger(value?.[key])&&value[key]>=0&&value[key]<=1000000)result[key]=value[key];
 return result;
}
