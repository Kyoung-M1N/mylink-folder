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
import { Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// 도메인 형식을 포함한 더 엄격한 URL 정규식
// (http(s)://) 유무와 상관없이 최소 '문자열.문자열' (TLD 포함) 형태를 검증
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
  const [links, setLinks] = useState<LinkProps[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore에서 링크 목록 가져오기 (실시간 리스너)
  useEffect(() => {
    const linksRef = collection(db, 'users', 'anonymous', 'links');
    const q = query(linksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLinks = snapshot.docs.map((doc) => ({
        id: doc.id as unknown as number, // Firestore ID 사용 (타입 호환을 위해 캐스팅)
        ...doc.data(),
      })) as LinkProps[];
      
      setLinks(fetchedLinks);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: { title: '', url: '' },
    mode: 'onChange',
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  };

  const onSubmit = async (data: LinkFormValues) => {
    let finalUrl = data.url;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    // 간단한 파비콘 추출 로직
    let domain = '';
    try {
      domain = new URL(finalUrl).hostname;
    } catch (err) {
      domain = finalUrl;
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    try {
      const linksRef = collection(db, 'users', 'anonymous', 'links');
      await addDoc(linksRef, {
        title: data.title,
        url: finalUrl,
        faviconUrl,
        createdAt: serverTimestamp(),
      });

      // 상태 초기화 및 폼 닫기
      reset();
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding link: ", error);
      alert("링크 추가 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="relative min-h-svh w-full bg-background overflow-hidden flex flex-col items-center py-20 px-6">
      {/* Background gradients for premium glassmorphism aesthetic */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="z-10 w-full max-w-md flex flex-col gap-8">
        {/* Profile Section */}
        <div className="text-center flex flex-col items-center relative">
          <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 shadow-xl mb-4 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-background">
            A
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">@개발자_Alex</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Front-End Developer | React
          </p>
        </div>

        {/* Add Link Dialog */}
        <div className="flex justify-center">
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="w-full max-w-xs shadow-md hover:shadow-lg transition-all rounded-full bg-foreground text-background hover:bg-foreground/90">
                <Plus className="mr-2 h-4 w-4" /> 새 링크 추가하기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/50 bg-background/80 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle>새로운 링크 추가</DialogTitle>
                <DialogDescription>
                  추가할 웹사이트의 이름과 주소를 입력해주세요.
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
                      className={`bg-background/50 ${errors.url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      aria-invalid={errors.url ? 'true' : 'false'}
                    />
                    {errors.url && <p className="text-sm text-red-500">{errors.url.message}</p>}
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">
                    취소
                  </Button>
                  <Button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-offset-background">
                    추가하기
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <Card className="transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden relative">
                  {/* Hover gradient effect line */}
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full" />
                  
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-muted/50 p-1.5 flex flex-shrink-0 items-center justify-center ring-1 ring-border shadow-sm group-hover:bg-background transition-colors">
                      {link.faviconUrl ? (
                        <img
                          src={link.faviconUrl}
                          alt={`${link.title} 파비콘`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // 이미지 로딩 실패 시 기본 대체 요소 처리
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('fallback-icon');
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground font-semibold">?</span>
                      )}
                    </div>
                    <h2 className="text-[15px] font-semibold flex-1 text-foreground/90 group-hover:text-foreground transition-colors text-center pr-10">
                      {link.title}
                    </h2>
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
