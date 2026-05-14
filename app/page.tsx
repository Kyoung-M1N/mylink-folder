"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LinkProps } from '@/data/links';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2, Pencil, Trash2, Check, X, AlertTriangle, LogIn } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';

// 도메인 형식을 포함한 더 엄격한 URL 정규식
const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/i;

const linkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '링크 제목을 입력해주세요.')
    .max(20, '링크 제목은 최대 20자까지 입력 가능합니다.'),
  url: z
    .string()
    .trim()
    .min(1, '기능 동작을 위해 링크(URL)를 입력해주세요.')
    .regex(urlRegex, '유효한 웹 주소(예: google.com) 형식이 아닙니다.'),
});

type LinkFormValues = z.infer<typeof linkSchema>;

export default function Page() {
  const { user, loading: authLoading, login } = useAuth();
  const [links, setLinks] = useState<LinkProps[]>([]);
  const [profile, setProfile] = useState<{ displayName?: string; username?: string; bio?: string; photoUrl?: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkProps | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<LinkProps | null>(null);

  // Firestore에서 프로필 및 링크 목록 가져오기 (실시간 리스너)
  useEffect(() => {
    if (!user) {
      setLinks([]);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // 프로필 정보 가져오기
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        // 프로필이 없는 경우 기본 정보 설정
        setProfile({
          username: user.displayName || '사용자',
          displayName: user.email?.split('@')[0] || 'user',
          photoUrl: user.photoURL || '',
          bio: '안녕하세요! 반갑습니다.'
        });
      }
    });

    // 링크 목록 가져오기
    const linksRef = collection(db, 'users', user.uid, 'links');
    const q = query(linksRef, orderBy('createdAt', 'desc'));

    const unsubscribeLinks = onSnapshot(q, (snapshot) => {
      const fetchedLinks = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        };
      }) as unknown as LinkProps[];
      
      setLinks(fetchedLinks);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
      setIsLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeLinks();
    };
  }, [user]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: { title: '', url: '' },
    mode: 'onTouched',
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset();
      setEditingLink(null);
    }
  };

  const onEdit = (link: LinkProps) => {
    setEditingLink(link);
    reset({
      title: link.title,
      url: link.url,
    });
  };

  const confirmDelete = (link: LinkProps) => {
    setLinkToDelete(link);
    setIsDeleteOpen(true);
  };

  const onDelete = async () => {
    if (!user || !linkToDelete) return;
    
    setIsSubmitting(true);
    try {
      const linkDoc = doc(db, 'users', user.uid, 'links', linkToDelete.id as unknown as string);
      await deleteDoc(linkDoc);
      setIsDeleteOpen(false);
      setLinkToDelete(null);
    } catch (error) {
      console.error("Error deleting link: ", error);
      alert("링크 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: LinkFormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    let finalUrl = data.url;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    let domain = '';
    try {
      domain = new URL(finalUrl).hostname;
    } catch (err) {
      domain = finalUrl;
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    try {
      if (editingLink) {
        // 수정 모드
        const linkDoc = doc(db, 'users', user.uid, 'links', editingLink.id as unknown as string);
        await updateDoc(linkDoc, {
          title: data.title,
          url: finalUrl,
          faviconUrl,
          updatedAt: serverTimestamp(),
        });
      } else {
        // 추가 모드
        const linksRef = collection(db, 'users', user.uid, 'links');
        await addDoc(linksRef, {
          title: data.title,
          url: finalUrl,
          faviconUrl,
          createdAt: serverTimestamp(),
        });
      }

      reset();
      setIsOpen(false);
      setEditingLink(null);
    } catch (error) {
      console.error("Error saving link: ", error);
      alert("링크 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100svh-64px)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-[calc(100svh-64px)] w-full bg-background overflow-hidden flex flex-col items-center justify-center py-20 px-6">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="z-10 w-full max-w-md text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              나만의 링크를<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">한 곳에 모아보세요</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Mylink를 통해 여러 채널의 링크를 하나의 프로필 페이지로 관리하고 공유할 수 있습니다.
            </p>
          </div>

          <Card className="border-border/50 bg-card/60 backdrop-blur-md p-8 shadow-xl">
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <LogIn className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">서비스 시작하기</h2>
                <p className="text-sm text-muted-foreground">
                  로그인 후 나만의 링크 리스트를 만들고<br />개인 프로필 페이지를 꾸며보세요.
                </p>
              </div>
              <Button 
                onClick={login}
                size="lg"
                className="w-full h-12 rounded-xl text-base font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md"
              >
                Google 계정으로 계속하기
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100svh-64px)] w-full bg-background overflow-hidden flex flex-col items-center py-20 px-6">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="z-10 w-full max-w-md flex flex-col gap-8">
        {/* Profile Section */}
        <div className="text-center flex flex-col items-center relative">
          <div className="h-24 w-24 rounded-full overflow-hidden shadow-xl mb-4 ring-4 ring-background flex items-center justify-center bg-muted">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.username || '프로필'} className="h-full w-full object-cover" />
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">
                {profile?.username?.[0] || user.displayName?.[0] || 'U'}
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {profile?.username || user.displayName || '사용자'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            @{profile?.displayName || user.email?.split('@')[0] || 'user'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {profile?.bio || '안녕하세요! 반갑습니다.'}
          </p>
        </div>

        {/* Add Link Dialog */}
        <div className="flex justify-center">
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button 
                className="w-full max-w-xs shadow-md hover:shadow-lg transition-all rounded-full bg-foreground text-background hover:bg-foreground/90"
                onClick={() => {
                  setEditingLink(null);
                  reset({ title: '', url: '' });
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> 새 링크 추가하기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-background/80 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle>{editingLink ? '링크 수정' : '새로운 링크 추가'}</DialogTitle>
                <DialogDescription>
                  {editingLink ? '링크 정보를 수정해주세요.' : '추가할 웹사이트의 이름과 주소를 입력해주세요.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="title" className="text-sm font-medium">링크 이름 (Title)</Label>
                    <Input
                      id="title"
                      placeholder="예: 개인 기술 블로그"
                      {...register("title")}
                      autoComplete="off"
                      className={`bg-background/50 ${errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      aria-invalid={errors.title ? 'true' : 'false'}
                    />
                    {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="url" className="text-sm font-medium">목적지 주소 (URL)</Label>
                    <Input
                      id="url"
                      placeholder="예: https://velog.io/@alex"
                      {...register("url")}
                      autoComplete="url"
                      className={`bg-background/50 ${errors.url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      aria-invalid={errors.url ? 'true' : 'false'}
                    />
                    {errors.url && <p className="text-sm text-red-500">{errors.url.message}</p>}
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsOpen(false)} 
                    className="rounded-xl"
                    disabled={isSubmitting}
                  >
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-offset-background"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      editingLink ? '수정하기' : '추가하기'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-background/80 backdrop-blur-xl">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground">정말 삭제하시겠습니까?</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground inline-block mb-1">
                  &quot;{linkToDelete?.title}&quot;
                </span> 
                링크가 삭제됩니다.
                <br />
                <span className="text-red-500 font-semibold mt-2 block">
                  ⚠️ 이 작업은 되돌릴 수 없습니다
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex sm:justify-center gap-3 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDeleteOpen(false)} 
                className="rounded-xl flex-1 max-w-[120px]"
                disabled={isSubmitting}
              >
                취소
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={onDelete}
                className="rounded-xl flex-1 max-w-[120px] bg-red-600 hover:bg-red-700 text-white shadow-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '삭제하기'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Links Section */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground p-8">
              링크를 불러오는 중...
            </div>
          ) : links.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 bg-card/30 rounded-2xl border border-dashed border-border">
              등록된 링크가 없습니다.
            </div>
          ) : (
            links.map((link) => (
              <div key={link.id as unknown as string} className="relative group">
                {editingLink?.id === link.id ? (
                  <Card className="border border-blue-500/50 bg-card/80 backdrop-blur-md overflow-hidden ring-1 ring-blue-500/20 shadow-lg">
                    <form onSubmit={handleSubmit(onSubmit)} className="p-3 flex items-center gap-3">
                      <div className="flex-1 flex flex-col gap-2">
                        <Input
                          {...register("title")}
                          placeholder="링크 제목"
                          autoComplete="off"
                          className={`h-9 text-sm bg-background/50 ${errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          autoFocus
                          disabled={isSubmitting}
                        />
                        <Input
                          {...register("url")}
                          placeholder="주소 (URL)"
                          autoComplete="url"
                          className={`h-9 text-sm bg-background/50 ${errors.url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button type="submit" size="icon" className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-muted" onClick={() => { setEditingLink(null); reset(); }} disabled={isSubmitting}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                    {(errors.title || errors.url) && (
                      <div className="px-3 pb-2">
                        {errors.title && <p className="text-[10px] text-red-500">{errors.title.message}</p>}
                        {errors.url && <p className="text-[10px] text-red-500">{errors.url.message}</p>}
                      </div>
                    )}
                  </Card>
                ) : (
                  <>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="block">
                      <Card className="transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden relative">
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full" />
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-muted/50 p-1.5 flex items-center justify-center ring-1 ring-border shadow-sm group-hover:bg-background transition-colors">
                            {link.faviconUrl ? (
                              <img src={link.faviconUrl} alt={`${link.title} 파비콘`} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-icon'); }} />
                            ) : (
                              <span className="text-xs text-muted-foreground font-semibold">?</span>
                            )}
                          </div>
                          <h2 className="text-[15px] font-semibold flex-1 text-foreground/90 group-hover:text-foreground text-center pr-10">{link.title}</h2>
                        </CardContent>
                      </Card>
                    </a>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 backdrop-blur hover:bg-background shadow-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(link); }} disabled={isSubmitting}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 backdrop-blur hover:bg-red-50 shadow-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(link); }} disabled={isSubmitting}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
