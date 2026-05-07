import { NextRequest } from 'next/server';
import { jsonHandler } from '../../_utils';
import { sendPasswordResetAction } from '@/lib/server/email-actions';

export async function POST(request: NextRequest) {
  return jsonHandler(async () => {
    const body = await request.json();
    return sendPasswordResetAction({ data: body });
  });
}
