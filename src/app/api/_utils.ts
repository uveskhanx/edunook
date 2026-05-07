import { NextResponse } from 'next/server';

export async function jsonHandler<T>(handler: () => Promise<T>) {
  try {
    const result = await handler();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    const status = /not found/i.test(message) ? 404 : /invalid|required|expired|cancelled/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
