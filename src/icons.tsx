import { useState } from 'react';
import { GlobeHemisphereWest, GithubLogo, FigmaLogo, YoutubeLogo, PinterestLogo, SpotifyLogo, NotionLogo, DribbbleLogo, BehanceLogo, BookOpen, Compass, Code, EnvelopeSimple, Image, PawPrint, Play, Planet, Camera } from '@phosphor-icons/react';
import type { DesktopLink } from './types';

const icons = {
  github: GithubLogo, figma: FigmaLogo, youtube: YoutubeLogo, pinterest: PinterestLogo,
  spotify: SpotifyLogo, notion: NotionLogo, dribbble: DribbbleLogo, behance: BehanceLogo,
  read: BookOpen, browser: Compass, code: Code, mail: EnvelopeSimple, image: Image,
  baidu: PawPrint, bilibili: Play, planet: Planet, camera: Camera,
};
const colors: Record<string, [string, string]> = {
  google: ['#fff', '#4285f4'], github: ['#252729', '#fff'], figma: ['#fff', '#363737'],
  youtube: ['#fff', '#f23d3d'], pinterest: ['#c73043', '#fff'], spotify: ['#2dbf6e', '#153526'],
  notion: ['#fff', '#262a28'], dribbble: ['#f8dfeb', '#bb5589'], behance: ['#2866ef', '#fff'],
  baidu: ['#fff', '#4163ee'], bilibili: ['#fff', '#e478a0'], read: ['#e9ad65', '#fff'],
  browser: ['#e7f0fb', '#3779ba'], mail: ['#528ae1', '#fff'], image: ['#f4e9b8', '#a77c30'],
};

export function AppIcon({ item, small = false }: { item: DesktopLink; small?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const name = item.icon ?? '';
  const Icon = icons[name as keyof typeof icons];
  const remote = /^(https?:\/\/|data:image\/|\/|\.\/)/i.test(name);
  const [background, color] = colors[name] ?? ['#e7ece6', '#4e6a54'];
  return <span className={`tably-app-icon${small ? ' tably-app-icon--small' : ''}`} style={{ background: item.color || background, color }}>
    {remote && failed !== name ? <img src={name} alt="" draggable={false} onError={() => setFailed(name)} />
      : name === 'google' ? <span className="tably-google-mark" aria-hidden="true">G</span>
      : Icon ? <Icon weight={name === 'figma' || name === 'notion' ? 'regular' : 'fill'} aria-hidden="true" />
      : name ? <span className="tably-letter-mark">{Array.from(item.title)[0]?.toUpperCase()}</span>
      : <GlobeHemisphereWest weight="duotone" aria-hidden="true" />}
  </span>;
}
