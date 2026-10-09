import {createEditorChat} from '../server/editor-model.js';
import {createOwnerHandlers} from '../server/owner-auth.js';
import {createWorkspaceHandlers,readDraft,workspaceConfiguration} from '../server/owner-workspace.js';
import {createWorkspaceStore} from '../server/workspace-store.js';
const auth=createOwnerHandlers();
const handlers=createWorkspaceHandlers({
 authorize:r=>auth.authorize(r),store:createWorkspaceStore(),drafts:readDraft,
 configured:()=>workspaceConfiguration().available,configuration:()=>workspaceConfiguration(),
 chat:createEditorChat()
});
export const GET=handlers.GET;export const POST=handlers.POST;
