"use strict";
// Durable one-shot entry point. Call it from a persisted platform scheduler; this
// process never installs a timer or claims to run unattended by itself.
const path=require("path");
const {openDb}=require("../lib/db");
const schedule=require("../lib/scheduler");
const file=process.env.FOLKLY_DB||path.join(__dirname,"..","folkly.db");
const db=openDb(file);
try{
  schedule.ensure(db);
  // There is no live Site MCP publisher in the current Site version. Keep this false
  // until Stage 08 installs and health-checks the supported server-side adapter.
  const providerAvailable=false;
  const result=process.argv.includes("--retry")
    ? schedule.retryDue(db,{providerAvailable})
    : schedule.publishToday(db,{providerAvailable});
  process.stdout.write(JSON.stringify(result)+"\n");
  if(!result.ok&&result.state!=="not-due"&&result.state!=="retry-backoff"&&result.state!=="no-current-day-retry")process.exitCode=2;
} catch(e){
  // Keep errors short and avoid serializing environment/configuration.
  process.stderr.write(JSON.stringify({ok:false,state:"runner-error",error:String(e.message||"scheduler failure").slice(0,400)})+"\n");
  process.exitCode=1;
} finally {db.close();}
