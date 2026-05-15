"use client";

import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy,
  getDocs,
  where,
  limit,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { useParams, notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MousePointer2 } from 'lucide-react';
import { LinkProps } from '@/data/links';

export default function PublicProfilePage() {
  const { username } = useParams();

  // 유저 프로필 조회
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: async () => {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      return {
        uid: userDoc.id,
        ...userDoc.data()
      } as { uid: string; displayName?: string; username?: string; bio?: string; photoUrl?: string };
    },
    enabled: !!username,
  });

  // 링크 목록 조회
  const { data: links = [], isLoading: isLinksLoading } = useQuery({
    queryKey: ['public-links', profile?.uid],
    queryFn: async () => {
      if (!profile?.uid) return [];
      const linksRef = collection(db, 'users', profile.uid, 'links');
      const q = query(linksRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        };
      }) as unknown as LinkProps[];
    },
    enabled: !!profile?.uid,
  });

  // 링크 클릭 핸들러
  const handleLinkClick = async (linkId: string) => {
    if (!profile?.uid || !linkId) return;
    
    try {
      const linkRef = doc(db, 'users', profile.uid, 'links', linkId);
      await updateDoc(linkRef, {
        clickCount: increment(1)
      });
    } catch (error) {
      console.error('Error updating click count:', error);
    }
  };

  if (isProfileLoading) {
    return (
      <div className="flex min-h-[calc(100svh-64px)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return notFound();
  }

  return (
    <div className="relative min-h-[calc(100svh-64px)] w-full bg-background overflow-hidden flex flex-col items-center py-20 px-6">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="z-10 w-full max-w-md flex flex-col gap-8">
        {/* Profile Section */}
        <div className="text-center flex flex-col items-center w-full max-sm:mx-auto p-4 rounded-3xl">
          <div className="h-24 w-24 rounded-full overflow-hidden shadow-xl mb-4 ring-4 ring-background flex items-center justify-center bg-muted">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.displayName || '프로필'} className="h-full w-full object-cover" />
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">
                {profile.displayName?.[0] || 'U'}
              </div>
            )}
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">
            {profile.displayName || '사용자'}
          </h1>
          
          <p className="text-sm text-muted-foreground font-medium mt-1">
            @{profile.username}
          </p>

          <p className="text-sm text-muted-foreground text-center mt-2 max-w-[280px]">
            {profile.bio || '안녕하세요! 반갑습니다.'}
          </p>
        </div>

        {/* Links Section */}
        <div className="flex flex-col gap-4">
          {isLinksLoading ? (
            <div className="text-center text-muted-foreground p-8">
              링크를 불러오는 중...
            </div>
          ) : links.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 bg-card/30 rounded-2xl border border-dashed border-border">
              등록된 링크가 없습니다.
            </div>
          ) : (
            links.map((link) => (
              <a 
                key={link.id as unknown as string} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block group"
                onClick={() => handleLinkClick(link.id.toString())}
              >
                <Card className="transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden relative">
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full" />
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-muted/50 p-1.5 flex items-center justify-center ring-1 ring-border shadow-sm group-hover:bg-background transition-colors shrink-0">
                      {link.faviconUrl ? (
                        <img 
                          src={link.faviconUrl} 
                          alt={`${link.title} 파비콘`} 
                          className="w-full h-full object-contain" 
                          onError={(e) => { 
                            e.currentTarget.style.display = 'none'; 
                            e.currentTarget.parentElement?.classList.add('fallback-icon'); 
                          }} 
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground font-semibold">?</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-center">
                      <h2 className="text-[15px] font-semibold text-foreground/90 group-hover:text-foreground text-center truncate w-full">
                        {link.title}
                      </h2>
                      {(link as any).clickCount > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground opacity-60">
                          <MousePointer2 className="h-2.5 w-2.5" />
                          <span>{(link as any).clickCount.toLocaleString()} clicks</span>
                        </div>
                      )}
                    </div>
                    <div className="w-10 shrink-0" /> {/* 좌측 아이콘 대칭용 공간 */}
                  </CardContent>
                </Card>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
