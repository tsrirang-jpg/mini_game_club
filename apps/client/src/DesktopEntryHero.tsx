import type { ReactNode } from 'react';
import { GameSwitch } from './GameSwitch';
import { useDesktopLayout } from './useDesktopLayout';

const introductions = {
  poker: { eyebrow: 'TEXAS HOLD’EM · NO-LIMIT', lines: ['อ่านเกมให้ขาด', 'แล้วเลือกตาของคุณ'], title: 'Poker ในวงไพ่', description: ['ไพ่ส่วนตัว 2 ใบ + ไพ่กลาง 5 ใบ', 'เพื่อนและบอทรวม 2–6 คน · แต้มจำลอง'], width: 1535, height: 658 },
  spyfall: { eyebrow: 'SECRET MISSION', lines: ['ใครคือสายลับ', 'ในวงของคุณ?'], title: 'Spyfall', description: ['ถามให้เนียน จับพิรุธให้ทัน', 'เล่นกับเพื่อน 3–8 คน · บทบาทลับเฉพาะคุณ'], width: 1527, height: 680 },
  oldmaid: { eyebrow: 'OLD MAID · อีแก่กินน้ำ', lines: ['จับคู่ให้หมดมือ', 'ใครจะเหลือใบสุดท้าย?'], title: 'อีแก่กินน้ำ', description: ['ผลัดกันจั่ว จับคู่ แล้วทิ้งอัตโนมัติ', 'เพื่อนและบอทรวม 3–8 คน'], width: 1459, height: 681 },
};

export function DesktopEntryHero({ game, children }: { game: keyof typeof introductions; children: ReactNode }) {
  const desktop = useDesktopLayout();
  if (!desktop) return children;
  const intro = introductions[game];
  return <>
    <nav className="entry-navigation" aria-label="เลือกเกม"><GameSwitch/></nav>
    <section className="intro entry-hero">
      <span className="eyebrow">{intro.eyebrow}</span>
      <h1>{intro.lines.map(line => <span className="entry-headline" key={line}>{line}</span>)}<span>{intro.title}</span></h1>
      <p>{intro.description[0]}<br/>{intro.description[1]}</p>
      <img className="entry-hero-art" src={`/images/entry/${game}-hero-v1.webp`} width={intro.width} height={intro.height} alt="" decoding="async"/>
    </section>
  </>;
}
