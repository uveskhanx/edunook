'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeSlash,
  Key,
  Lock,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react';

export default function ChangePasswordClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) {
    router.push('/login');
    return null;
  }

  const handleVerifyCurrent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser?.email) return;

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      setError(null);
      setStep(2);
      toast.success('Identity verified', { description: 'You can now set your new password.' });
    } catch (err: any) {
      setError('The current password you entered is incorrect.');
      toast.error('Incorrect password', { description: 'Please try again or use the forgot password flow.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.currentUser) return;

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password too short', { description: 'Password must be at least 6 characters.' });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully');
      setTimeout(() => router.push('/settings'), 1000);
    } catch (err: any) {
      toast.error('Update failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showSettings={false}>
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-10 sm:px-6 md:py-20">
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="group mb-8 flex min-h-11 items-center gap-2 rounded-2xl px-1 text-sm font-black text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          Back to Settings
        </button>

        <div className="premium-glass relative overflow-hidden rounded-3xl border border-border p-6 shadow-2xl sm:p-8 md:p-12">
          <div className="absolute right-0 top-0 -z-10 h-64 w-64 bg-primary/10 blur-[100px]" />

          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
              {step === 1 ? <ShieldCheck size={32} weight="duotone" /> : <Key size={32} weight="duotone" />}
            </div>
            <h1 className="mb-2 text-3xl font-black tracking-tight text-foreground">
              {step === 1 ? 'Secure verification' : 'Create new password'}
            </h1>
            <p className="text-sm font-medium leading-6 text-muted-foreground">
              {step === 1
                ? 'Confirm your current password before changing account security.'
                : 'Choose a strong password that you have not used before.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleVerifyCurrent}
                className="space-y-6"
              >
                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((visible) => !visible)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
                  >
                    <WarningCircle size={16} weight="fill" />
                    {error}
                  </motion.div>
                )}

                <PrimaryButton disabled={loading || !currentPassword} loading={loading}>
                  Verify identity
                </PrimaryButton>
              </motion.form>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleUpdatePassword}
                className="space-y-6"
              >
                <PasswordField
                  id="new-password"
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  icon={<CheckCircle size={20} />}
                />

                <div className="flex items-start gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <WarningCircle size={20} className="shrink-0 text-primary" weight="bold" />
                  <p className="text-sm font-medium leading-6 text-primary/80">
                    Changing your password keeps this device signed in, but it may end other active sessions for security.
                  </p>
                </div>

                <PrimaryButton disabled={loading || !newPassword || !confirmPassword} loading={loading}>
                  Update password
                </PrimaryButton>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  showPassword,
  onToggleVisibility,
  icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  showPassword?: boolean;
  onToggleVisibility?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="ml-3 text-sm font-black text-foreground">
        {label}
      </label>
      <div className="relative group">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
          {icon || <Lock size={20} />}
        </span>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-16 w-full rounded-2xl border border-border bg-foreground/[0.03] pl-14 pr-14 font-bold text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-foreground/[0.05]"
        />
        {onToggleVisibility && (
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          >
            {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-16 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
    >
      {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : children}
      {!loading && <ArrowRight size={18} weight="bold" />}
    </button>
  );
}
