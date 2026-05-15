export interface LinkProps {
  id: string | number;
  title: string;
  url: string;
  faviconUrl?: string;
  clickCount?: number;
  createdAt: string;
}

export const DUMMY_LINKS: LinkProps[] = [
  {
    id: 1,
    title: '인스타그램',
    url: 'https://instagram.com',
    faviconUrl: 'https://www.instagram.com/favicon.ico',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: '유튜브',
    url: 'https://youtube.com',
    faviconUrl: 'https://www.youtube.com/favicon.ico',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: '블로그',
    url: 'https://velog.io',
    faviconUrl: 'https://velog.io/favicon.ico',
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    title: '깃허브',
    url: 'https://github.com',
    faviconUrl: 'https://github.com/favicon.ico',
    createdAt: new Date().toISOString(),
  },
  {
    id: 5,
    title: '포트폴리오',
    url: 'https://portfolio.com',
    faviconUrl: 'https://portfolio.com/favicon.ico',
    createdAt: new Date().toISOString(),
  },
];
