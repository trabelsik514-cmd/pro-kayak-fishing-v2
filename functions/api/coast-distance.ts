import handler from '../../api/coast-distance';
import { adaptVercelHandler } from '../_shared/vercel-compat';

export const onRequest = adaptVercelHandler(handler);
