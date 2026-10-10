import handler from '../../api/chlorophyll';
import { adaptVercelHandler } from '../_shared/vercel-compat';

export const onRequest = adaptVercelHandler(handler);
