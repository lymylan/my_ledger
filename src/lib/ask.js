/* Thay cho window.confirm() — bị chặn im lặng trong iframe sandbox (luôn trả false).
   App đăng ký handler qua setAsk(); ESM cấm gán trực tiếp vào biến import,
   nên bắt buộc phải có setter thay vì `_ask = fn` như bản một-file. */
let _ask=null;
export const setAsk=fn=>{ _ask=fn };
export const ask=(msg,onOk,okLabel)=>{ if(_ask) _ask(msg,onOk,okLabel); else onOk(); };
