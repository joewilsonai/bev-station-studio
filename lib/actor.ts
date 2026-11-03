import { AsyncLocalStorage } from "async_hooks";
const store = new AsyncLocalStorage<string>();
// Who is making this request. Set once per request, read by the change log.
export const setActor = (name: string) => store.enterWith(name);
export const actor = () => store.getStore() ?? "the studio";
