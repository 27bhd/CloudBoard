import type { Env } from '../../src/server/env';
import { handleApi } from '../../src/server';

/** Pages Functions adapter: all edge logic lives in src/server. */
export const onRequest: PagesFunction<Env> = ({ request, env }) => handleApi(request, env);
