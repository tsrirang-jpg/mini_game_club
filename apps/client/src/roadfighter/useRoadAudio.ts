import {useEffect} from 'react';
import type {RoadEngine} from './engine';
// Synthesized locally: no external sound requests or autoplay on the menu.
export function useRoadAudio(engine:RoadEngine,enabled:boolean){useEffect(()=>{
  if(!enabled||typeof AudioContext==='undefined')return;
  let context:AudioContext|undefined,osc:OscillatorNode|undefined,gain:GainNode|undefined,timer:ReturnType<typeof setInterval>|undefined;
  const unlock=()=>{if(context)return;try{context=new AudioContext();osc=context.createOscillator();gain=context.createGain();osc.type='sawtooth';gain.gain.value=0;osc.connect(gain);gain.connect(context.destination);osc.start();void context.resume().catch(()=>{});
    let pickups=engine.pickupCount;timer=setInterval(()=>{if(!context||!osc||!gain)return;const running=engine.phase==='running';osc.frequency.setTargetAtTime(35+engine.speed*.45,context.currentTime,.08);gain.gain.setTargetAtTime(running ? .018 : 0,context.currentTime,.04);if(engine.pickupCount>pickups){const note=context.createOscillator(),volume=context.createGain();note.type='square';note.frequency.setValueAtTime(660,context.currentTime);note.frequency.linearRampToValueAtTime(990,context.currentTime+.12);volume.gain.setValueAtTime(.035,context.currentTime);volume.gain.exponentialRampToValueAtTime(.001,context.currentTime+.2);note.connect(volume);volume.connect(context.destination);note.start();note.stop(context.currentTime+.2);note.onended=()=>{note.disconnect();volume.disconnect();};}pickups=engine.pickupCount;},100);
  }catch{void context?.close().catch(()=>{});context=undefined;}};
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
  return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);if(timer)clearInterval(timer);osc?.stop();osc?.disconnect();gain?.disconnect();void context?.close().catch(()=>{});};
},[engine,enabled]);}
