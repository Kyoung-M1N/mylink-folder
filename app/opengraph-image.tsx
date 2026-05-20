import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import { join } from 'path';

export const alt = 'Mylink - 개발자를 위한 멀티링크 허브';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // 로컬 파일시스템에서 Pretendard 폰트 읽기
  const fontBold = readFileSync(
    join(process.cwd(), 'public/fonts/Pretendard-Bold.woff')
  );

  const fontRegular = readFileSync(
    join(process.cwd(), 'public/fonts/Pretendard-Regular.woff')
  );

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
          backgroundColor: '#09090b', // zinc-950
          backgroundImage: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.15) 0%, transparent 60%), radial-gradient(circle at bottom, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
          fontFamily: 'Pretendard',
          color: 'white',
          padding: '40px 80px',
        }}
      >
        {/* 서비스 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(to right, #2563eb, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '24px',
              color: 'white',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            M
          </div>
          <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Mylink</span>
        </div>

        {/* 메인 타이틀 */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.25,
            marginBottom: '24px',
            letterSpacing: '-1.5px',
            background: 'linear-gradient(to right, #60a5fa, #a78bfa, #f472b6)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          나만의 포트폴리오를 한 곳에 감각적으로
        </div>

        {/* 설명 문구 */}
        <div
          style={{
            fontSize: '22px',
            fontWeight: 400,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.6,
          }}
        >
          이력서, 깃허브, 기술 블로그, SNS까지. 흩어져 있는 나의 모든 기록과 프로젝트를 하나의 모던한 프로필 페이지로 담아내고 편리하게 공유하세요.
        </div>

        {/* 하단 장식 요소 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '48px',
            fontSize: '14px',
            color: '#52525b',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '24px',
            width: '60%',
            justifyContent: 'center',
          }}
        >
          <span>⚡️ 3초 소셜 로그인</span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#3f3f46' }} />
          <span>🎨 감각적인 테마</span>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#3f3f46' }} />
          <span>📊 실시간 방문 통계</span>
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
