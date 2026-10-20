import type {Difficulty} from './engine';
export interface RoadPreferences {name:string;difficulty:Difficulty;sound:boolean}
export interface RoadRecords {score:number;distance:number}
const PREFS='wongsian.roadfighter.preferences.v1',RECORDS='wongsian.roadfighter.records.v1';
function read(key:string):Record<string,unknown>{try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function loadPreferences():RoadPreferences{const p=read(PREFS);let saved='';try{saved=localStorage.getItem('pok.name')||'';}catch{}return {name:typeof p.name==='string'?p.name.slice(0,20):saved||'Player',difficulty:p.difficulty==='easy'||p.difficulty==='hard'?p.difficulty:'normal',sound:p.sound!==false};}
export function savePreferences(p:RoadPreferences){try{localStorage.setItem(PREFS,JSON.stringify(p));}catch{}}
export function loadRecords():RoadRecords{const p=read(RECORDS);return {score:typeof p.score==='number'&&Number.isFinite(p.score)?Math.max(0,Math.floor(p.score)):0,distance:typeof p.distance==='number'&&Number.isFinite(p.distance)?Math.max(0,p.distance):0};}
export function saveRecords(score:number,distance:number):RoadRecords{const old=loadRecords();const next={score:Math.max(old.score,Math.floor(score)),distance:Math.max(old.distance,distance)};try{localStorage.setItem(RECORDS,JSON.stringify(next));}catch{}return next;}
