export const MAG=[1e3,1e4,1e5,1e6];
export const suggestAmounts=v=>(!v||v>=10000)?[]:MAG.map(m=>v*m).filter(n=>n<=1e9);
export const TAG_COLORS=['#2B3A8F','#C33F4C','#0F7A57','#6B54C6','#A96700','#0E7490','#9A3412','#4B5563','#BE185D','#15803D'];
export const ACC_COLORS=['#2B3A8F','#0E7490','#0F7A57','#A96700','#C33F4C','#6B54C6','#B3286B','#4B5563'];
export const ACC_ICONS=['bank','wallet','card','coin','cash','piggy','briefcase','home','car','plane',
  'cart','gift','star','heart','cup','book','grad','health','phone','jar','gem','ticket','umbrella','chart'];
export const accColor=a=>(a&&a.color)||ACC_COLORS[0];
export const accIcon=a=>(a&&a.icon)||(a&&a.kind==='cash'?'wallet':'bank');
export const GROUPS=[{k:'basic',n:'Essentials',c:'#2B3A8F'},{k:'debt',n:'Debt',c:'#4C5DBF'},
  {k:'save',n:'Savings',c:'#8590DC'}];
export const CUSTOM_C='#B8BFEE';
export const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
