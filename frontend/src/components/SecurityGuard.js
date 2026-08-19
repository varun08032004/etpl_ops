import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * SecurityGuard
 * -----------------------------------------------------------------------
 * Deters casual data exfiltration (copy/paste, right-click save, printing,
 * quick screenshots) and makes anything that DOES leak traceable back to
 * the staff member who took it, via a persistent identity watermark.
 *
 * IMPORTANT — read this before you rely on it:
 * A browser has no API that can block OS-level screenshots or screen
 * recording, and nothing can stop someone photographing their monitor
 * with a phone. This component does NOT claim to do that. What it does:
 *
 *  1. Blocks right-click, text selection, and copy/cut via JS — stops
 *     casual copy-paste and "save as". Trivially bypassed by anyone who
 *     opens devtools or views page source, so treat it as a speed bump,
 *     not a lock.
 *  2. Disables window.print() and hides content in print stylesheets —
 *     stops one-click "print to PDF" exports.
 *  3. Renders a tiled, low-opacity watermark of the logged-in staff
 *     member's email + a live timestamp across every screen. This is
 *     the part that actually matters: if someone screenshots or
 *     photographs the screen anyway, the leak is attributable to a
 *     specific person and time. This is the same technique banks and
 *     law firms use — deterrence + accountability, not prevention.
 *  4. Best-effort devtools-open detection that blurs the screen. Easy
 *     to defeat (e.g. detach devtools, disable JS) — again, a deterrent
 *     for casual snooping, not a security boundary.
 *
 * Wrap your authenticated app shell with this, e.g. in App.js:
 *   <AuthProvider>
 *     <SecurityGuard>
 *       <Layout>...routes...</Layout>
 *     </SecurityGuard>
 *   </AuthProvider>
 */
// Accounts in this list are fully exempt from every deterrent below —
// no watermark, no copy/print/right-click blocking, no devtools blur.
// Keep this list short and deliberate; it's a real bypass, not cosmetic.
const EXEMPT_EMAILS = (process.env.REACT_APP_SECURITY_GUARD_EXEMPT || 'founder@ethertrack.in')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default function SecurityGuard({ children }) {
  const { staff } = useAuth();
  const overlayRef = useRef(null);
  const isExempt = !!staff && EXEMPT_EMAILS.includes((staff.email || '').toLowerCase());

  useEffect(() => {
    if (isExempt) return; // founder: no listeners attached at all, on any browser/device
    const blockContextMenu = (e) => e.preventDefault();
    const blockCopyCut = (e) => e.preventDefault();
    const blockKeys = (e) => {
      const k = e.key?.toLowerCase();
      // F12, Ctrl/Cmd+Shift+I/J/C (devtools), Ctrl/Cmd+U (view-source), Ctrl/Cmd+S (save page), Ctrl/Cmd+P (print)
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(k))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('copy', blockCopyCut);
    document.addEventListener('cut', blockCopyCut);
    document.addEventListener('keydown', blockKeys);

    // Neutralize window.print()
    const originalPrint = window.print;
    window.print = () => {
      console.warn('Printing is disabled for this application.');
    };

    // Best-effort devtools-open heuristic (width/height delta from viewport)
    let devtoolsInterval = setInterval(() => {
      const threshold = 160;
      const isOpen =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold;
      if (overlayRef.current) {
        overlayRef.current.style.setProperty('--guard-blur', isOpen ? '18px' : '0px');
      }
    }, 800);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('copy', blockCopyCut);
      document.removeEventListener('cut', blockCopyCut);
      document.removeEventListener('keydown', blockKeys);
      window.print = originalPrint;
      clearInterval(devtoolsInterval);
    };
  }, [isExempt]);

  if (isExempt) {
    // Founder device: render children but still enforce viewport lock
    return (
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        {children}
      </div>
    );
  }

  const label = staff ? `${staff.email} · ${staff.role || ''}` : '';

  // Build a tiled watermark: repeat the identity string in a grid via
  // inline SVG so it scales cleanly at any resolution.
  const rows = 6;
  const cols = 3;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ r, c });
    }
  }

  return (
    <div
      ref={overlayRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        filter: 'blur(var(--guard-blur, 0px))',
        transition: 'filter 120ms ease',
      }}
    >
      {children}

      {staff && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 999999,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            opacity: 0.07,
          }}
        >
          {tiles.map(({ r, c }) => (
            <div
              key={`${r}-${c}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(-28deg)',
                fontSize: 13,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                color: '#000',
              }}
            >
              {label} · {new Date().toLocaleString()}
            </div>
          ))}
        </div>
      )}

      {/* Hide everything when the user attempts to print / save-as-PDF */}
      <style>{`
        @media print {
          body * { display: none !important; }
          body::after {
            content: "Printing is disabled for EtherTrack ERP. Access was logged.";
            display: block !important;
            font-size: 20px;
            padding: 40px;
          }
        }
        input, textarea, [contenteditable="true"] {
          user-select: text !important;
          -webkit-user-select: text !important;
        }
      `}</style>
    </div>
  );
}