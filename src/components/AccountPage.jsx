import { useState } from 'react';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { readableAuthError } from '../lib/authErrors';
import { ask } from '../lib/ask';
import { I } from './Icon';
import { Field, PasswordInput } from './ui';

/* Page level-2 mở từ ⚙ Settings, cùng pattern với Plan template và Money I lent.
   Cố ý KHÔNG dùng Sheet lồng trong Sheet: Sheet set document.body.overflow và
   nghe Escape, hai cái lồng nhau sẽ tranh nhau khi đóng cái trong. */
export function AccountPage({ user, onSignOut, toast }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const tooShort = next.length > 0 && next.length < 6;
  const mismatch = again.length > 0 && next !== again;
  const canSubmit = cur.length >= 6 && next.length >= 6 && next === again && !busy;

  const change = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    if (next === cur) { setErr('That is the password you already have.'); return }
    setBusy(true); setErr(null);
    try {
      /* Firebase bắt buộc xác thực lại trước khi đổi mật khẩu — nếu không sẽ
         trả auth/requires-recent-login. Đây cũng là lớp chặn người khác đổi
         mật khẩu khi bạn để máy mở. */
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, next);
      setCur(''); setNext(''); setAgain('');
      toast('Password changed');
    } catch (e2) {
      setErr(readableAuthError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 6 }}>
        <div className="row">
          <div className="dot n"><I n="bank" s={17} /></div>
          <div className="row-b">
            <div className="row-t">Signed in as</div>
            <div className="row-s">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="sec-h"><h2>Change password</h2></div>
      <form className="card" style={{ padding: 16 }} onSubmit={change}>
        <Field label="Current password">
          <PasswordInput id="ap-cur" value={cur} onChange={setCur}
            autoComplete="current-password" placeholder="Your password now" />
        </Field>
        <Field label="New password">
          <PasswordInput id="ap-new" value={next} onChange={setNext}
            autoComplete="new-password" placeholder="At least 6 characters" />
        </Field>
        <Field label="New password again">
          <PasswordInput id="ap-again" value={again} onChange={setAgain}
            autoComplete="new-password" placeholder="Type it once more" />
        </Field>

        {tooShort && <p style={{ color: 'var(--warn)', fontSize: 12.5, margin: '0 0 11px', fontWeight: 600 }}>
          New password needs at least 6 characters.</p>}
        {mismatch && <p style={{ color: 'var(--warn)', fontSize: 12.5, margin: '0 0 11px', fontWeight: 600 }}>
          The two new passwords do not match.</p>}
        {err && <p style={{ color: 'var(--out)', fontSize: 12.5, margin: '0 0 11px', fontWeight: 600 }}>{err}</p>}

        <button className="btn pri blk" type="submit" disabled={!canSubmit}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>

      <p className="mut" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        Your ledger lives in your account, so this password is the only way in.
        If you forget it, use <b>Forgot your password?</b> on the sign-in screen —
        it emails a reset link to {user.email}.
      </p>

      <div className="sec-h"><h2>Session</h2></div>
      <button className="btn gho blk" onClick={() => ask('Sign out?', onSignOut, 'Sign out')}>
        Sign out
      </button>
    </div>
  );
}
