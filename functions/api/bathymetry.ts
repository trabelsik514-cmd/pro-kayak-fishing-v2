import handler from '../../api/bathymetry';
import { adaptVercelHandler } from '../_shared/vercel-compat';

export const onRequest = adaptVercelHandler(handler);
