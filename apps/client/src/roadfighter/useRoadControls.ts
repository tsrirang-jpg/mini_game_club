import {useCallback,useEffect,useRef} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {Control,RoadEngine} from './engine';
const bindings:Record<string,Control>={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'accelerate',KeyW:'accelerate',ArrowDown:'brake',KeyS:'brake'};
export function useRoadControls(engine:RoadEngine,onChange:()=>void){
  const keys=useRef(new Set<string>()),pointers=useRef(new Map<number,Control>()),notify=useRef(onChange);notify.current=onChange;
  const update=useCallback(()=>{engine.clearControls();for(const key of keys.current){const control=bindings[key];if(control)engine.controls[control]=true;}for(const control of pointers.current.values())engine.controls[control]=true;},[engine]);
  const reset=useCallback(()=>{keys.current.clear();pointers.current.clear();engine.clearControls();},[engine]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],dialog[open]'))return;if(bindings[e.code]){e.preventDefault();keys.current.add(e.code);update();}else if(['Space','Escape','KeyP'].includes(e.code)&&!e.repeat){e.preventDefault();reset();engine.togglePause();notify.current();}};
    const up=(e:KeyboardEvent)=>{if(bindings[e.code]){e.preventDefault();keys.current.delete(e.code);update();}};
    const pause=()=>{reset();engine.pause();notify.current();};const visibility=()=>{if(document.hidden)pause();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
    return()=>{reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);};
  },[engine,reset,update]);
  const release=(e:ReactPointerEvent<HTMLButtonElement>)=>{pointers.current.delete(e.pointerId);update();};
  return {reset,bind:(control:Control)=>({onPointerDown:(e:ReactPointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,control);update();},onPointerUp:release,onPointerCancel:release,onLostPointerCapture:release,onContextMenu:(e:React.MouseEvent)=>e.preventDefault()})};
}
