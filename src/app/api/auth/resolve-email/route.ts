import { NextRequest } from 'next/server';
import { jsonHandler } from '../../_utils';
import { resolveAuthEmailAction } from '@/lib/server/auth-actions';

export async function POST(request: NextRequest) {
  return jsonHandler(async () => {
    const body = await request.json();
    return resolveAuthEmailAction({ data: body });
  });
}
