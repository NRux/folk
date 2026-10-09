import {createEditorialImportHandler} from '../server/editorial-import.js';
// No ticket-issuance or public content-reading operation exists on this route.
const handler=createEditorialImportHandler();
export const POST=handler;
export const GET=handler;
