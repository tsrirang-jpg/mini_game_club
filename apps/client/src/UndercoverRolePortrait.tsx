import type {UnderRole} from '../../../packages/shared/src/undercover';
import {undercoverRoleImage} from './assets/images';
import './undercover-role-portrait.css';

export const underRoleNames:Record<UnderRole,string>={citizen:'คนธรรมดา',undercover:'Undercover',white:'Mr. White'};

// Reveal and results share one cached sprite; no character artwork is mounted in play.
export function UnderRolePortrait({role}:{role:UnderRole}) {
  return <div className={`under-role-portrait role-${role}`} role="img" aria-label={`ภาพบทบาท ${underRoleNames[role]}`} style={{backgroundImage:`url(${undercoverRoleImage.src})`}}/>;
}
