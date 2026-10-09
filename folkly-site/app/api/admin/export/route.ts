import { env } from 'cloudflare:workers';
import { exportResponse } from '../../../../lib/export-snapshot.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return exportResponse(request, env); }
