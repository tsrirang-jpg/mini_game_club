import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
// Native modal focus containment and Escape handling shared by game overlays.
export function GameDialog({title,onClose,children,className='',dismissible=true}:{title:string;onClose():void;children:ReactNode;className?:string;dismissible?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className={`club-dialog ${className}`} aria-label={title} onCancel={event=>{event.preventDefault();if(dismissible)onClose();}}>
    {dismissible&&<button type="button" className="dialog-close" aria-label="ปิดหน้าต่าง" onClick={onClose}>✕</button>}<h2>{title}</h2>{children}
  </dialog>;
}
