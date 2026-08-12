import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I } from './Icon';

/* Firebase trả code máy đọc; đây là bản dịch cho người đọc.
   Từ 2024 Firebase gộp user-not-found + wrong-password thành invalid-credential
   để không tiết lộ email nào đã tồn tại — nên message phải chung cho cả hai. */
const MSG = {
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled on this project.',
};
const readable = e => MSG[e && e.code] || (e && e.message) || 'Something went wrong.';

export function AuthGate() {
  const [mode, setMode] = useState('in');          // 'in' | 'up'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);

  const canSubmit = /\S+@\S+\.\S+/.test(email) && pw.length >= 6 && !busy;

  const submit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      if (mode === 'up') await createUserWithEmailAndPassword(auth, email.trim(), pw);
      else await signInWithEmailAndPassword(auth, email.trim(), pw);
      /* Không cần setSt gì ở đây: App lắng nghe onAuthStateChanged rồi tự load. */
    } catch (e2) {
      setErr(readable(e2));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Type your email first, then tap this again.'); return; }
    setBusy(true); setErr(null); setNote(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNote('Reset link sent. Check your inbox.');
    } catch (e2) { setErr(readable(e2)); } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', paddingTop: 'max(8vh, 40px)' }}>
      <div className="brand" style={{ justifyContent: 'center', fontSize: 22, marginBottom: 6 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8, background: 'var(--indigo)',
          display: 'grid', placeItems: 'center', color: '#fff',
        }}><I n="jar" s={17} /></span>
        Ledger
      </div>
      <p className="mut" style={{ textAlign: 'center', fontSize: 13, margin: '0 0 22px' }}>
        {mode === 'up'
          ? 'Create an account to keep your ledger on all your devices.'
          : 'Sign in to reach your ledger from any device.'}
      </p>

      <form className="card" style={{ padding: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="ag-email">Email</label>
          <input id="ag-email" className="inp" type="email" autoComplete="email"
            inputMode="email" autoCapitalize="none" spellCheck="false"
            placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ag-pw">Password</label>
          <input id="ag-pw" className="inp" type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            placeholder="At least 6 characters"
            value={pw} onChange={e => setPw(e.target.value)} />
        </div>

        {err && <p style={{ color: 'var(--out)', fontSize: 12.5, margin: '0 0 11px', fontWeight: 600 }}>{err}</p>}
        {note && <p style={{ color: 'var(--in)', fontSize: 12.5, margin: '0 0 11px', fontWeight: 600 }}>{note}</p>}

        <button className="btn pri blk" type="submit" disabled={!canSubmit}>
          {busy ? 'Working…' : mode === 'up' ? 'Create account' : 'Sign in'}
        </button>

        {mode === 'in' && (
          <button className="lnk" type="button" onClick={reset} disabled={busy}
            style={{ display: 'block', margin: '13px auto 0', fontSize: 13 }}>
            Forgot your password?
          </button>
        )}
      </form>

      <p className="mut" style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>
        {mode === 'up' ? 'Already have an account? ' : 'New here? '}
        <button className="lnk" type="button" style={{ fontSize: 13 }}
          onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(null); setNote(null) }}>
          {mode === 'up' ? 'Sign in' : 'Create one'}
        </button>
      </p>

      <p className="mut" style={{ textAlign: 'center', fontSize: 12, marginTop: 26, lineHeight: 1.5 }}>
        Your ledger syncs through your account. Keep a copy with
        <br />⚙ → Download backup (.json) now and then.
      </p>
    </div>
  );
}
