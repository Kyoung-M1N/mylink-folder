import { Metadata } from 'next';

interface Props {
  children: React.ReactNode;
  params: Promise<{
    username: string;
  }>;
}

// Firestore REST API를 사용하여 안전하게 유저 정보를 가져오는 헬퍼 함수
async function getUserProfile(username: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'username' },
              op: 'EQUAL',
              value: { stringValue: username }
            }
          },
          limit: 1
        }
      }),
      next: { revalidate: 60 } // 1분간 캐시
    });

    if (!res.ok) return null;
    const result = await res.json();
    if (!result || result.length === 0 || !result[0].document) return null;

    const fields = result[0].document.fields || {};
    return {
      displayName: fields.displayName?.stringValue || '사용자',
      bio: fields.bio?.stringValue || '안녕하세요! 반갑습니다.',
    };
  } catch (error) {
    console.error('Error fetching user for layout metadata:', error);
    return null;
  }
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { username } = await params;
  const profile = await getUserProfile(username);

  const displayName = profile?.displayName || username;
  const bio = profile?.bio || `${displayName}님의 Mylink 프로필 페이지입니다.`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mylink-folder.vercel.app';
  const ogImageUrl = `${appUrl}/${username}/opengraph-image`;

  return {
    title: `${displayName} (@${username})`,
    description: bio,
    openGraph: {
      title: `${displayName} (@${username}) | Mylink`,
      description: bio,
      url: `${appUrl}/${username}`,
      siteName: 'Mylink',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${displayName}님의 프로필 오픈 그래프 이미지`,
        }
      ],
      locale: 'ko_KR',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} (@${username}) | Mylink`,
      description: bio,
      images: [ogImageUrl],
    }
  };
}

export default function UserProfileLayout({ children }: Props) {
  return <>{children}</>;
}
