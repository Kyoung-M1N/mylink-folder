import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'Mylink Profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{
    username: string;
  }>;
}

// Firestore REST API를 사용하여 안전하게 유저 및 링크 데이터를 조회하는 헬퍼 함수
async function fetchUserData(username: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('Firebase Project ID is missing');
    return null;
  }

  try {
    // 1. 유저 username 쿼리 실행
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const userResponse = await fetch(queryUrl, {
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
      next: { revalidate: 10 } // 10초 간 캐시 유지
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to query user: ${userResponse.statusText}`);
    }

    const userQueryResult = await userResponse.json();
    if (!userQueryResult || userQueryResult.length === 0 || !userQueryResult[0].document) {
      return null;
    }

    const userDoc = userQueryResult[0].document;
    const fields = userDoc.fields || {};

    const nameParts = userDoc.name.split('/');
    const uid = nameParts[nameParts.length - 1];

    const profile = {
      uid,
      displayName: fields.displayName?.stringValue || '사용자',
      bio: fields.bio?.stringValue || '안녕하세요! 반갑습니다.',
    };

    // 2. 유저의 links 서브컬렉션 전체 목록 조회
    const linksUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/links`;
    const linksResponse = await fetch(linksUrl, {
      method: 'GET',
      next: { revalidate: 10 }
    });

    let linksCount = 0;
    let linksSample: any[] = [];

    if (linksResponse.ok) {
      const linksData = await linksResponse.json();
      if (linksData.documents) {
        linksCount = linksData.documents.length;
        linksSample = linksData.documents.map((doc: any) => {
          const f = doc.fields || {};
          return {
            title: f.title?.stringValue || '링크',
            url: f.url?.stringValue || '',
          };
        }).slice(0, 3);
      }
    }

    return { profile, linksCount, linksSample };
  } catch (error) {
    console.error('Error fetching data via Firestore REST API:', error);
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { username } = await params;

  // 로컬 파일시스템에서 Pretendard 폰트 읽기
  const fontBold = readFileSync(
    join(process.cwd(), 'public/fonts/Pretendard-Bold.woff')
  );

  const fontRegular = readFileSync(
    join(process.cwd(), 'public/fonts/Pretendard-Regular.woff')
  );

  // Firestore REST API 조회 수행
  const data = await fetchUserData(username);

  // 프로필이 없는 경우에 보여줄 기본 OG 이미지
  if (!data || !data.profile) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#09090b',
            backgroundImage: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.15) 0%, transparent 60%)',
            fontFamily: 'Pretendard',
            color: 'white',
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: 800 }}>Mylink</div>
          <div style={{ fontSize: '22px', color: '#71717a', marginTop: '16px' }}>
            찾을 수 없는 프로필이거나 존재하지 않는 경로입니다.
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [{ name: 'Pretendard', data: fontBold, weight: 700 }],
      }
    );
  }

  const { profile, linksCount, linksSample } = data;
  const displayName = profile.displayName;
  const bio = profile.bio;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
          fontFamily: 'Pretendard',
          color: 'white',
          padding: '60px 80px',
        }}
      >
        {/* 좌측 영역: 프로필 상세 정보 */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '55%', justifyContent: 'center' }}>
          {/* 프로필 이미지 데코레이션 및 유저 네임 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '28px' }}>
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '55px',
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #db2777 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '44px',
                fontWeight: 800,
                color: 'white',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
              }}
            >
              {displayName[0]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>
                  {displayName}
                </span>
              </div>
              <span style={{ fontSize: '18px', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>
                @{username}
              </span>
            </div>
          </div>

          {/* 한 줄 소개(Bio) */}
          <div
            style={{
              fontSize: '22px',
              color: '#d4d4d8',
              lineHeight: 1.5,
              marginBottom: '36px',
              maxWidth: '520px',
              fontWeight: 400,
            }}
          >
            {bio}
          </div>

          {/* 활성 링크 수 뱃지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', color: '#a1a1aa' }}>Mylink 포트폴리오</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#818cf8',
                backgroundColor: 'rgba(129, 140, 248, 0.1)',
                padding: '4px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(129, 140, 248, 0.2)',
              }}
            >
              {linksCount}개의 활성 링크
            </span>
          </div>
        </div>

        {/* 우측 영역: 주요 링크 카드 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '40%', gap: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#71717a', marginBottom: '4px', letterSpacing: '0.5px' }}>
            CONNECTED LINKS
          </div>

          {linksSample.length === 0 ? (
            <div
              style={{
                padding: '32px 24px',
                borderRadius: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#52525b',
                fontSize: '15px',
                textAlign: 'center',
              }}
            >
              공개된 링크가 없습니다.
            </div>
          ) : (
            linksSample.map((link, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {link.title}
                  </span>
                  <span style={{ fontSize: '12px', color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                    {link.url.replace(/^(https?:\/\/)?(www\.)?/, '')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Pretendard',
          data: fontRegular,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Pretendard',
          data: fontBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
