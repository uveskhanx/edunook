import { NextRequest } from 'next/server';
import { jsonHandler } from '../../_utils';
import { getCloudinarySignatureAction } from '@/lib/server/cloudinary-actions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return jsonHandler(async () => {
    const body = await request.json();
    return getCloudinarySignatureAction({ data: body });
  });
}
