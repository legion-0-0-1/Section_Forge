export type VideoInfo =
  | { kind: 'youtube'; id: string; embed: string }
  | { kind: 'vimeo'; id: string; embed: string }
  | { kind: 'file'; src: string }
  | { kind: 'none' };

export function parseVideo(url: string): VideoInfo {
  const u = (url || '').trim();
  if (!u) return { kind: 'none' };
  const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
  if (yt) return { kind: 'youtube', id: yt[1], embed: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
  if (vm) return { kind: 'vimeo', id: vm[1], embed: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: 'file', src: u };
}
