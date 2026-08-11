export const KEY='lo.expense.v1';
export async function loadState(){
  if(window.storage){try{const r=await window.storage.get(KEY);if(r&&r.value)return JSON.parse(r.value)}catch(e){}}
  try{const v=localStorage.getItem(KEY);if(v)return JSON.parse(v)}catch(e){}
  return null;
}
export async function saveState(s){
  const j=JSON.stringify(s);
  if(window.storage){try{await window.storage.set(KEY,j);return}catch(e){}}
  try{localStorage.setItem(KEY,j)}catch(e){}
}
export async function wipe(){
  if(window.storage){try{await window.storage.delete(KEY)}catch(e){}}
  try{localStorage.removeItem(KEY)}catch(e){}
}
