type ActionPayload<T> = { data: T };

async function postAction<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : 'Request failed';
    throw new Error(message);
  }
  return payload as TResponse;
}

export function resolveAuthEmailAction(payload: ActionPayload<{ username: string }>) {
  return postAction<{ success: boolean; email: string }>('/api/auth/resolve-email', payload.data);
}

export function sendFeedbackEmailAction(payload: ActionPayload<{
  email: string;
  type: string;
  message: string;
  username: string;
  userId?: string;
}>) {
  return postAction<{ success: boolean }>('/api/feedback', payload.data);
}

export function getCloudinarySignatureAction(payload: ActionPayload<{
  paramsToSign: {
    timestamp: number;
    folder: string;
  };
}>) {
  return postAction<{ signature: string; timestamp: number; apiKey: string }>('/api/cloudinary/signature', payload.data);
}
