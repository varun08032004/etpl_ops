import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Leaf, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import globeImage from '../assets/ethertrack-globe.png';
import logoImage from '../assets/ethertrack-logo.png';

/* ------------------------------------------------------------------ */
/*  Shared field primitives (kept dumb/presentational, no logic)      */
/* ------------------------------------------------------------------ */

function Field({ icon: Icon, label, labelAccent, error, children, rightIcon }) {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="mb-2 flex items-center gap-1 text-[13px] font-medium text-white/90">
          {label}
          {labelAccent && <Plus className="h-3 w-3 text-[#22C55E]" strokeWidth={3} />}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
        )}
        {children}
        {rightIcon && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35">
            {rightIcon}
          </div>
        )}
      </div>
    </div>
  );
}

const inputBase =
  'h-[48px] w-full rounded-xl border border-white/10 bg-black/40 pl-14 pr-14 text-[15px] text-white ' +
  'placeholder:text-white/30 outline-none transition-all duration-200 ' +
  'focus:border-[#22C55E]/60 focus:bg-black/60 focus:ring-4 focus:ring-[#22C55E]/10 ' +
  'login-input';

/* ------------------------------------------------------------------ */
/*  Forgot-password sub-form                                          */
/* ------------------------------------------------------------------ */

function ForgotPasswordForm({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await client.post('/auth/forgot-password', { email });
      setMessage({ severity: 'success', text: data.message });
    } catch (err) {
      setMessage({ severity: 'error', text: 'Something went wrong — please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <p className="mb-3.5 text-[13px] leading-relaxed text-white/50">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <Field icon={Mail}>
        <input
          className={inputBase}
          type="email"
          placeholder="you@ethertrack.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </Field>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
              message.severity === 'success'
                ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#4ADE80]'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <PrimaryButton type="submit" loading={loading} loadingLabel="Sending…">
        Send reset link
      </PrimaryButton>

      <button
        type="button"
        onClick={onBackToLogin}
        className="mt-3 w-full rounded-xl py-3 text-[13.5px] font-medium text-white/50 transition-colors hover:text-white login-secondary-button"
      >
        Back to sign in
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable primary CTA button                                       */
/* ------------------------------------------------------------------ */

function PrimaryButton({ children, loading, loadingLabel, ...props }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.15 }}
      disabled={loading}
      className="group relative flex h-[46px] w-full items-center justify-center gap-2 rounded-xl
                 bg-[#22C55E] text-[15px] font-semibold text-black shadow-[0_0_0_1px_rgba(34,197,94,0.4),0_8px_24px_-8px_rgba(34,197,94,0.55)]
                 transition-all duration-200 hover:bg-[#2ED66E] hover:shadow-[0_0_0_1px_rgba(34,197,94,0.55),0_10px_32px_-6px_rgba(34,197,94,0.7)]
                 disabled:cursor-not-allowed disabled:opacity-60 login-button"
      {...props}
    >
      <span>{loading ? loadingLabel : children}</span>
      {!loading && (
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
    </motion.button>
  );
}

function ErrorBanner({ error }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400 login-error-banner"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Earth-at-night / India-lit-up visual                              */
/*  Uses the real reference photo as a background image, with a       */
/*  light particle overlay on top for subtle motion.                  */
/*  Drop the asset at src/assets/ethertrack-globe.png (or adjust the  */
/*  import path below) — it's included in the files panel.            */
/* ------------------------------------------------------------------ */

function GlobeVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Atmosphere glow behind the image */}
      <div className="absolute left-1/2 top-0 h-[140%] w-[140%] -translate-x-1/2 rounded-full
                      bg-[radial-gradient(circle_at_50%_15%,rgba(34,197,94,0.14),transparent_55%)]" />

      {/* Reference globe photo — fills the container, object-position tuned so India stays fully visible */}
      <img
        src={globeImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '50% 72%' }}
      />

      {/* Edge fades so the image blends into the page bg instead of showing a hard box */}
      <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[#050807] to-transparent" />
      <div className="absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-[#050807] to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-[#050807] to-transparent" />

      {/* Floating particles for subtle ambient motion */}
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={`p-${i}`}
          className="absolute h-[2px] w-[2px] rounded-full bg-[#22C55E]/70"
          style={{
            left: `${(i * 53) % 100}%`,
            top: `${(i * 37) % 90}%`,
            animation: `float-particle ${6 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Login component — all state/handlers preserved verbatim      */
/* ------------------------------------------------------------------ */

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [awaitingTwoFactor, setAwaitingTwoFactor] = useState(false);
  const [awaitingDeviceApproval, setAwaitingDeviceApproval] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, verifyDevice } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.twoFactorRequired) {
        setAwaitingTwoFactor(true);
      } else if (result.deviceApprovalRequired) {
        setAwaitingDeviceApproval(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password, twoFactorCode);
      if (result.deviceApprovalRequired) {
        setAwaitingTwoFactor(false);
        setAwaitingDeviceApproval(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDevice = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyDevice(email, otp, navigator.userAgent.slice(0, 100));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#050807] font-sans text-white flex flex-col login-page-container">
      <style>{`
        @keyframes pulse-node {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          50% { transform: translateY(-14px) translateX(6px); opacity: 0.8; }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>

      {/* ambient top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px]
                      bg-[radial-gradient(ellipse_at_50%_-10%,rgba(34,197,94,0.08),transparent_60%)]" />

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-1 min-h-0 flex-col items-stretch justify-center px-6 lg:flex-row lg:px-10 lg:py-6 login-main-flex">

        {/* ============================= LEFT PANEL ============================= */}
        <div className="relative flex min-h-0 w-full flex-col justify-between lg:w-[55%] lg:pr-14 lg:py-2 login-left-panel">
          <div>
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 flex items-center gap-3 lg:mb-8"
            >
              <img
                src={logoImage}
                alt="EtherTrack Technologies"
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              />
              <div className="leading-none">
                <div className="text-[24px] font-extrabold tracking-tight sm:text-[27px]">
                  <span className="text-white">ETHER</span>
                  <span className="text-[#22C55E]">TRACK</span>
                </div>
                <div className="mt-1 text-[10px] font-medium tracking-[0.22em] text-white/50 sm:text-[11px]">
                  TECHNOLOGIES PRIVATE LIMITED
                </div>
              </div>
            </motion.div>

            {/* Hero */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[38px] lg:text-[42px] xl:text-[46px]"
            >
              <span className="text-white">Engineering Trust</span>
              <br />
              <span className="text-[#22C55E]">for a Sustainable Future</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-4 h-px w-10 bg-[#22C55E]/60"
            />

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-4 max-w-[440px] text-[13.5px] leading-relaxed text-white/45 lg:text-[14.5px]"
            >
              Empowering organizations with transparency, traceability and trust
              through technology. Together, we build a sustainable tomorrow.
            </motion.p>
          </div>

{/* Globe */}
            <div className="relative mt-4 min-h-0 flex-1 w-full login-globe-visual">
              <GlobeVisual />
            </div>
        </div>

        {/* ============================= RIGHT PANEL ============================= */}
        <div className="flex w-full min-h-0 items-center justify-center py-4 lg:w-[45%] lg:py-2 login-right-panel">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative w-full max-w-[480px] rounded-3xl border border-white/[0.08] bg-[#0F1313]/90
                       p-6 sm:p-7 lg:p-8 login-form-container"
          >

            {/* Secure badge */}
            <div className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full border border-[#22C55E]/25
                            bg-[#22C55E]/10 px-2.5 py-1 text-[10.5px] font-medium text-[#4ADE80] sm:right-7 sm:top-7 login-secure-badge">
              <ShieldCheck className="h-3 w-3" />
              Secure Access
            </div>

            {/* Mobile branding - shows on mobile, hidden on desktop */}
            <div className="lg:hidden mb-6 text-center">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-4 flex items-center justify-center gap-3"
              >
                <img
                  src={logoImage}
                  alt="EtherTrack Technologies"
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <div className="leading-none">
                  <div className="text-[20px] font-extrabold tracking-tight">
                    <span className="text-white">ETHER</span>
                    <span className="text-[#22C55E]">TRACK</span>
                  </div>
                  <div className="mt-0.5 text-[9px] font-medium tracking-[0.22em] text-white/50">
                    TECHNOLOGIES PRIVATE LIMITED
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="h-px w-8 bg-[#22C55E]/60 mx-auto"
              />
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="mt-3 text-[12px] leading-relaxed text-white/40 text-center"
              >
                Empowering organizations with transparency, traceability and trust
                through technology.
              </motion.p>
            </div>

            <h2 className="text-[22px] font-bold tracking-tight sm:text-[24px]">
              ETPL <span className="text-[#22C55E]">Ops</span>
            </h2>
            <p className="mb-5 mt-1 text-[13px] text-white/45">
              Sign in to EtherTrack Technologies internal tools
            </p>

            <AnimatePresence mode="wait">
              {forgotMode ? (
                <motion.div key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ForgotPasswordForm onBackToLogin={() => setForgotMode(false)} />
                </motion.div>
              ) : awaitingTwoFactor ? (
                <motion.form key="2fa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleTwoFactorSubmit} className="login-form">
                  <p className="mb-5 text-[13.5px] leading-relaxed text-white/50">
                    Enter the 6-digit code from your authenticator app, or one of your backup codes.
                  </p>
                  <Field label="Authenticator or backup code" icon={Lock}>
                    <input
                      className={inputBase}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      required
                      autoFocus
                    />
                  </Field>
                  <ErrorBanner error={error} />
                  <PrimaryButton type="submit" loading={loading} loadingLabel="Verifying…">
                    Verify &amp; sign in
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={() => { setAwaitingTwoFactor(false); setTwoFactorCode(''); setError(''); }}
                    className="mt-3 w-full rounded-xl py-3 text-[13.5px] font-medium text-white/50 transition-colors hover:text-white login-secondary-button"
                  >
                    Back to sign in
                  </button>
                </motion.form>
              ) : awaitingDeviceApproval ? (
                <motion.form key="device" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleVerifyDevice} className="login-form">
                  <p className="mb-5 text-[13.5px] leading-relaxed text-white/50">
                    This browser isn&apos;t recognized yet. Enter the approval code sent to{' '}
                    <span className="text-white/80">{email}</span>.
                  </p>
                  <Field label="Approval code" icon={Mail}>
                    <input
                      className={inputBase}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      autoFocus
                      maxLength={6}
                      inputMode="numeric"
                    />
                  </Field>
                  <ErrorBanner error={error} />
                  <PrimaryButton type="submit" loading={loading} loadingLabel="Verifying…">
                    Approve device &amp; sign in
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={() => { setAwaitingDeviceApproval(false); setOtp(''); setError(''); }}
                    className="mt-3 w-full rounded-xl py-3 text-[13.5px] font-medium text-white/50 transition-colors hover:text-white login-secondary-button"
                  >
                    Back to sign in
                  </button>
                </motion.form>
              ) : (
                <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit} className="login-form">
                  <Field label="Email" labelAccent icon={Mail}>
                    <input
                      className={inputBase}
                      type="email"
                      placeholder="you@ethertrack.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </Field>

                  <Field label="Password" icon={Lock} rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-white/35 transition-colors hover:text-white/70"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  }>
                    <input
                      className={inputBase}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>

                  <div className="-mt-1.5 mb-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-[13px] font-medium text-white/50 transition-colors hover:text-[#22C55E] login-forgot-link"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <ErrorBanner error={error} />

                  <PrimaryButton type="submit" loading={loading} loadingLabel="Signing in…">
                    Sign in
                  </PrimaryButton>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Divider / trust line */}
            <div className="mt-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="whitespace-nowrap text-[11.5px] text-white/35">
                Secured by design. Built for trust.
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mt-3.5 flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#22C55E]/25 bg-[#22C55E]/5 login-shield-icon">
                <ShieldCheck className="h-3.5 w-3.5 text-[#22C55E]" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================= FOOTER ============================= */}
      <div className="relative mx-auto flex w-full max-w-[1600px] shrink-0 flex-col items-center justify-between gap-1.5 border-t
                      border-white/[0.06] px-6 py-3 text-[11.5px] text-white/35 sm:flex-row lg:px-10 login-footer">
        <div className="flex items-center gap-2">
          <Leaf className="h-3.5 w-3.5 text-[#22C55E]/70" />
          Building trust today for a greener tomorrow.
        </div>
        <div className="text-center">
          © {new Date().getFullYear()} EtherTrack Technologies Private Limited. All rights reserved.
        </div>
      </div>
    </div>
  );
}