import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | null;
    confirmationResult: ConfirmationResult | undefined;
  }
}
