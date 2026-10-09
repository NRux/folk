import { createOwnerHandlers } from '../server/owner-auth.js';
const handlers = createOwnerHandlers();
export const POST = handlers.POST;
export const GET = handlers.GET;
