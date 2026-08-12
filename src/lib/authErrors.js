/* Firebase trả code máy đọc; đây là bản dịch cho người đọc.
   Dùng chung cho AuthGate (đăng nhập/đăng ký) và AccountPage (đổi mật khẩu).

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
  /* Chỉ gặp khi đổi mật khẩu */
  'auth/requires-recent-login': 'For safety, sign out and sign in again before changing your password.',
};

export const readableAuthError = e => (e && MSG[e.code]) || (e && e.message) || 'Something went wrong.';
