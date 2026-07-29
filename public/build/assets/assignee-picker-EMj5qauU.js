import{a as t}from"./app-logo-icon-IipaxuKl.js";import{j as a}from"./app-DOOD4q7A.js";import{f as d}from"./textarea-BAHS5eQ_.js";import{C as i}from"./checkbox-Bt1CzO5u.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M17.5 17.5 16 16.3V14",key:"akvzfd"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]],v=t("CalendarClock",h);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}]],M=t("CircleDot",m);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]],j=t("MessageSquare",p);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],N=t("Send",k);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M8 7v7",key:"1x2jlm"}],["path",{d:"M12 7v4",key:"xawao1"}],["path",{d:"M16 7v9",key:"1hp2iy"}]],C=t("SquareKanban",x);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],_=t("TriangleAlert",y);function w({options:s,selectedIds:c,onChange:n}){const l=(e,r)=>{n(r?[...new Set([...c,e])]:c.filter(o=>o!==e))};return a.jsx("div",{className:"crm-scrollbar grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.02]",children:s.length===0?a.jsx("span",{className:"p-3 text-sm text-slate-500 dark:text-slate-400",children:"Нет доступных исполнителей."}):s.map(e=>{var r;return a.jsxs("label",{className:"flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg p-2 transition hover:bg-blue-50 dark:hover:bg-blue-500/5",children:[a.jsx(i,{checked:c.includes(e.id),onCheckedChange:o=>l(e.id,o===!0)}),a.jsx(d,{name:e.name,className:"size-7 rounded-lg"}),a.jsxs("span",{className:"min-w-0 text-sm",children:[a.jsx("span",{className:"block truncate font-medium",children:e.name}),a.jsx("span",{className:"block truncate text-xs text-slate-500 dark:text-slate-400",children:((r=e.roles)==null?void 0:r.join(", "))||e.email||"Сотрудник"})]})]},e.id)})})}export{w as A,M as C,j as M,C as S,_ as T,v as a,N as b};
