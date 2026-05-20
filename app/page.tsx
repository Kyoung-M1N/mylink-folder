"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Loader2, Pencil, Trash2, Check, X, AlertTriangle, LogIn, MousePointer2, Sparkles, BarChart3, Layout, Smartphone, ArrowRight, Zap, Globe, ShieldCheck, Code2, Laptop, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  getDoc,
  where,
  increment
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



const profileSchema = z.object({
  displayName: z.string().trim().min(1, '이름을 입력해주세요.').max(20, '이름은 최대 20자까지 가능합니다.'),
  username: z.string().trim().min(3, '아이디는 최소 3자 이상이어야 합니다.').max(20, '아이디는 최대 20자까지 가능합니다.').regex(/^[a-zA-Z0-9_.]+$/, '영문, 숫자, 밑줄, 마침표만 사용할 수 있습니다.'),
  bio: z.string().trim().max(100, '소개글은 최대 100자까지 가능합니다.').optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Page() {
  const { user, loading: authLoading, login } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingField, setEditingField] = useState<'displayName' | 'username' | 'bio' | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [editingLink, setEditingLink] = useState<LinkProps | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<LinkProps | null>(null);

  // 프로필 데이터 쿼리
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: async () => {
      if (!user) return null;
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as { displayName?: string; username?: string; bio?: string; photoUrl?: string };
      }
      
      return {
        username: user.email?.split('@')[0] || 'user',
        displayName: user.displayName || '사용자',
        photoUrl: user.photoURL || '',
        bio: '안녕하세요! 반갑습니다.'
      };
    },
    enabled: !!user,
  });

  // 링크 목록 쿼리
  const { data: links = [], isLoading: isLinksLoading } = useQuery({
    queryKey: ['links', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const linksRef = collection(db, 'users', user.uid, 'links');
      const q = query(linksRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        };
      }) as unknown as LinkProps[];
    },
    enabled: !!user,
  });

  // 링크 클릭 핸들러
  const handleLinkClick = async (linkId: string) => {
    if (!user || !linkId) return;
    
    try {
      const linkRef = doc(db, 'users', user.uid, 'links', linkId);
      await updateDoc(linkRef, {
        clickCount: increment(1)
      });
      // 데이터 최신화를 위해 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['links', user.uid] });
    } catch (error) {
      console.error('Error updating click count:', error);
    }
  };

  // 프로필 업데이트 뮤테이션 (낙관적 업데이트)
  const updateProfileMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string, value: string }) => {
      if (!user) throw new Error('Not authenticated');

      // 아이디 중복 검사
      if (field === 'username' && value !== profile?.username) {
        const q = query(collection(db, 'users'), where('username', '==', value));
        const snapshot = await getDocs(q);
        const isDuplicate = snapshot.docs.some(doc => doc.id !== user.uid);
        if (isDuplicate) throw new Error('DUPLICATE_USERNAME');
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
      return { field, value };
    },
    onMutate: async ({ field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['profile', user?.uid] });
      const previousProfile = queryClient.getQueryData(['profile', user?.uid]);
      queryClient.setQueryData(['profile', user?.uid], (old: any) => ({
        ...old,
        [field]: value,
      }));
      return { previousProfile };
    },
    onError: (err: any, variables, context) => {
      queryClient.setQueryData(['profile', user?.uid], context?.previousProfile);
      if (err.message === 'DUPLICATE_USERNAME') {
        toast.error('이미 사용 중인 아이디입니다.');
      } else {
        toast.error('프로필 업데이트 중 오류가 발생했습니다.');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
    },
    onSuccess: () => {
      toast.success('수정되었습니다.');
      setEditingField(null);
    },
  });

  // 링크 관리 뮤테이션 (추가/수정)
  const saveLinkMutation = useMutation({
    mutationFn: async (data: { title: string, url: string }) => {
      if (!user) throw new Error('Not authenticated');

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

      if (editingLink) {
        const linkDoc = doc(db, 'users', user.uid, 'links', editingLink.id as unknown as string);
        await updateDoc(linkDoc, {
          title: data.title,
          url: finalUrl,
          faviconUrl,
          updatedAt: serverTimestamp(),
        });
      } else {
        const linksRef = collection(db, 'users', user.uid, 'links');
        await addDoc(linksRef, {
          title: data.title,
          url: finalUrl,
          faviconUrl,
          createdAt: serverTimestamp(),
          clickCount: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', user?.uid] });
      reset();
      setIsOpen(false);
      setEditingLink(null);
      toast.success(editingLink ? '링크가 수정되었습니다.' : '링크가 추가되었습니다.');
    },
    onError: () => {
      toast.error('링크 저장 중 오류가 발생했습니다.');
    }
  });

  // 링크 삭제 뮤테이션
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      if (!user) throw new Error('Not authenticated');
      const linkDoc = doc(db, 'users', user.uid, 'links', linkId);
      await deleteDoc(linkDoc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links', user?.uid] });
      setIsDeleteOpen(false);
      setLinkToDelete(null);
      toast.success('링크가 삭제되었습니다.');
    },
    onError: () => {
      toast.error('링크 삭제 중 오류가 발생했습니다.');
    }
  });

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

  const startEditing = (field: 'displayName' | 'username' | 'bio', currentValue: string) => {
    setEditingField(field);
    setFieldValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setFieldValue('');
  };

  const saveField = async () => {
    if (!user || !editingField) return;

    // 변경된 내용이 없으면 그냥 종료
    const currentValue = (profile as any)?.[editingField];
    if (fieldValue === currentValue) {
      cancelEditing();
      return;
    }

    try {
      profileSchema.shape[editingField].parse(fieldValue);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.issues[0].message);
      }
      return;
    }

    updateProfileMutation.mutate({ field: editingField, value: fieldValue });
  };

  const onDelete = () => {
    if (!linkToDelete) return;
    deleteLinkMutation.mutate(linkToDelete.id as unknown as string);
  };

  const onSubmit = (data: LinkFormValues) => {
    saveLinkMutation.mutate(data);
  };

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

  const isPending = updateProfileMutation.isPending || saveLinkMutation.isPending || deleteLinkMutation.isPending;

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100svh-64px)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-[calc(100svh-64px)] w-full bg-background overflow-hidden flex flex-col items-center justify-start pb-24 px-4 sm:px-6 lg:px-8">
        {/* 상단 메쉬 그라데이션 및 조명 효과 */}
        <div className="absolute top-[-10%] left-[calc(50%-300px)] w-[600px] h-[600px] bg-purple-500/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="z-10 w-full max-w-6xl space-y-24 pt-12 sm:pt-20">
          {/* 1. Hero Section */}
          <div className="text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50/50 border border-blue-200/60 backdrop-blur-md text-blue-700 text-xs sm:text-sm font-semibold shadow-sm">
              <Sparkles className="h-4 w-4 text-blue-600 animate-spin duration-3000" />
              <span>개발자를 위한 단 하나의 멀티링크 허브</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.15] text-foreground">
              나만의 포트폴리오를<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                한 곳에 감각적으로
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
              이력서, 깃허브, 기술 블로그, SNS까지. 흩어져 있는 나의 모든 기록과 프로젝트를 하나의 모던한 프로필 페이지로 담아내고 공유하세요.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                onClick={login}
                size="lg"
                className="w-full sm:w-auto h-14 px-8 rounded-2xl text-base font-bold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 group"
              >
                <LogIn className="mr-2 h-5 w-5 text-background group-hover:scale-110 transition-transform" />
                <span>Google 계정으로 시작하기</span>
                <ArrowRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={login}
                className="w-full sm:w-auto h-14 px-8 rounded-2xl text-base font-semibold border-border hover:bg-muted/50 transition-all"
              >
                <span>3초 만에 프로필 만들기</span>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> 복잡한 가입 절차 없음</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> 평생 무료 사용</span>
            </div>
          </div>

          {/* 2. Visual Mockup Section (대시보드 및 링크 카드 연출) */}
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-purple-500/10 rounded-3xl blur-2xl pointer-events-none" />
            <Card className="border-border/60 bg-card/40 backdrop-blur-xl p-6 sm:p-10 shadow-2xl rounded-3xl ring-1 ring-white/20 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                {/* 목업 좌측: 프로필 및 링크 카드 예시 */}
                <div className="w-full lg:w-1/2 space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-background/60 border border-border/40 shadow-sm">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                      M
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-base text-foreground">Alex Kim</h4>
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">@alex_dev</p>
                      <p className="text-xs text-foreground/80 mt-0.5">Frontend Engineer & Open Source Contributor</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* 링크 예시 1 */}
                    <div className="p-4 rounded-2xl bg-background/80 border border-border/50 shadow-md flex items-center gap-4 hover:border-blue-500/50 transition-all group cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 p-2 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
                        <Code2 className="w-full h-full text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-foreground group-hover:text-blue-600 transition-colors">GitHub Profile</h5>
                        <p className="text-[11px] text-muted-foreground truncate">github.com/alex-kim</p>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/80">
                        <MousePointer2 className="h-3 w-3 text-blue-600" />
                        <span className="text-xs font-mono font-bold text-blue-700">1,245</span>
                      </div>
                    </div>

                    {/* 링크 예시 2 */}
                    <div className="p-4 rounded-2xl bg-background/80 border border-border/50 shadow-md flex items-center gap-4 hover:border-purple-500/50 transition-all group cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 p-2 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition-transform">
                        <Laptop className="w-full h-full text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-foreground group-hover:text-purple-600 transition-colors">Tech Blog (Velog)</h5>
                        <p className="text-[11px] text-muted-foreground truncate">velog.io/@alex</p>
                      </div>
                      <div className="flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100/80">
                        <MousePointer2 className="h-3 w-3 text-purple-600" />
                        <span className="text-xs font-mono font-bold text-purple-700">892</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 목업 우측: 통계 및 관리 대시보드 예시 */}
                <div className="w-full lg:w-1/2 space-y-6 bg-background/40 p-6 rounded-2xl border border-border/40 shadow-inner">
                  <div className="flex items-center justify-between border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <h4 className="font-bold text-base text-foreground">인사이트 및 관리 대시보드</h4>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">실시간 연동 중</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">전체 누적 클릭수</p>
                      <p className="text-2xl font-extrabold text-foreground font-mono">2,137 <span className="text-xs font-bold text-blue-600">회</span></p>
                    </div>
                    <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">활성 링크 수</p>
                      <p className="text-2xl font-extrabold text-foreground font-mono">5 <span className="text-xs font-bold text-purple-600">개</span></p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg space-y-3 relative overflow-hidden">
                    <div className="absolute right-[-20%] bottom-[-20%] w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-300" />
                      <h5 className="font-bold text-sm">스마트 파비콘 연동 기술</h5>
                    </div>
                    <p className="text-xs text-blue-100 leading-relaxed">
                      별도의 이미지 업로드 없이 웹사이트 주소(URL)만 입력하면 자동으로 파비콘과 로고를 추출하여 프로필에 매핑합니다.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 3. Feature Section (핵심 기능 및 장점 소개) */}
          <div className="space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                개발자 브랜딩에 최적화된<br />핵심 기능들을 만나보세요
              </h2>
              <p className="text-base text-muted-foreground">
                단순한 링크 모음을 넘어, 나를 알리고 증명하는 가장 효과적인 방법을 제공합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <Card className="border-border/50 bg-card/60 backdrop-blur-md p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-3xl group">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="h-7 w-7 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">원클릭 스마트 연동</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    복잡한 아이콘 찾기나 이미지 업로드 과정은 잊으세요. 목적지 URL만 입력하면 도메인 파비콘과 타이틀이 자동으로 프로필에 연동됩니다.
                  </p>
                </div>
              </Card>

              {/* Feature 2 */}
              <Card className="border-border/50 bg-card/60 backdrop-blur-md p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-3xl group">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-7 w-7 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">실시간 클릭 통계</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    내 프로필을 방문한 사람들이 어떤 프로젝트와 이력서에 가장 관심이 많은지, 직관적인 차트와 랭킹 대시보드로 실시간 확인이 가능합니다.
                  </p>
                </div>
              </Card>

              {/* Feature 3 */}
              <Card className="border-border/50 bg-card/60 backdrop-blur-md p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all rounded-3xl group">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smartphone className="h-7 w-7 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">완벽한 모바일 최적화</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    데스크톱은 물론 태블릿과 모바일 기기에서도 완벽한 비율과 속도로 동작하여, 인스타그램이나 깃허브 바이오 링크로 사용하기에 최적입니다.
                  </p>
                </div>
              </Card>
            </div>
          </div>

          {/* 4. Bottom CTA Banner (하단 전환 유도 배너) */}
          <Card className="border-border/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-10 sm:p-16 shadow-2xl rounded-3xl text-center relative overflow-hidden">
            <div className="absolute top-[-50%] left-[-20%] w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-50%] right-[-20%] w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                지금 바로 나만의<br />멀티링크 허브를 시작하세요
              </h2>
              <p className="text-base sm:text-lg text-blue-100/90 font-normal">
                Google 계정만 있다면 3초 만에 나만의 고유한 프로필 주소를 만들고 링크를 공유할 수 있습니다.
              </p>
              <div className="pt-4 flex justify-center">
                <Button 
                  onClick={login}
                  size="lg"
                  className="h-14 px-10 rounded-2xl text-base font-bold bg-background text-foreground hover:bg-background/90 transition-all shadow-xl hover:shadow-2xl hover:scale-105 group"
                >
                  <LogIn className="mr-2 h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span>Google 계정으로 계속하기</span>
                </Button>
              </div>
              <p className="text-xs text-blue-200/80 pt-2">
                ⚡️ 별도의 설치나 카드 등록이 필요 없는 100% 무료 서비스입니다.
              </p>
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
        <div className="text-center flex flex-col items-center w-full max-w-sm mx-auto p-4 rounded-3xl">
          <div className="h-24 w-24 rounded-full overflow-hidden shadow-xl mb-4 ring-4 ring-background flex items-center justify-center bg-muted">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.displayName || '프로필'} className="h-full w-full object-cover" />
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">
                {profile?.displayName?.[0] || user.displayName?.[0] || 'U'}
              </div>
            )}
          </div>

          {/* Display Name */}
          {editingField === 'displayName' ? (
            <div className="flex justify-center w-full mt-1">
              <div className="relative flex items-center">
                <Input 
                  value={fieldValue} 
                  onChange={e => setFieldValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="h-9 w-40 text-center font-bold text-lg bg-background/50"
                  autoFocus
                  disabled={isPending}
                />
                <div className="absolute left-[calc(100%+4px)] flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={saveField} disabled={isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing} disabled={isPending}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="group/field relative flex items-center justify-center gap-2 mt-1 min-h-[36px]">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {profile?.displayName || user.displayName || '사용자'}
              </h1>
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover/field:opacity-100 absolute -right-8 transition-opacity" onClick={() => startEditing('displayName', profile?.displayName || user.displayName || '사용자')}>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}

          {/* Username */}
          <div className="group/field relative flex items-center justify-center gap-2 mt-1 min-h-[32px]">
            <p className="text-sm text-muted-foreground font-medium">
              @{profile?.username || user.email?.split('@')[0] || 'user'}
            </p>
          </div>

          {/* Bio */}
          {editingField === 'bio' ? (
            <div className="flex justify-center w-full mt-2">
              <div className="relative flex items-center w-full max-w-[280px]">
                <Input 
                  value={fieldValue} 
                  onChange={e => setFieldValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="h-8 flex-1 text-center text-sm bg-background/50"
                  autoFocus
                  disabled={isPending}
                />
                <div className="absolute left-[calc(100%+4px)] flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={saveField} disabled={isPending}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditing} disabled={isPending}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="group/field relative flex items-center justify-center gap-2 mt-2 min-h-[32px] w-full max-w-[280px]">
              <p className="text-sm text-muted-foreground text-center">
                {profile?.bio || '안녕하세요! 반갑습니다.'}
              </p>
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover/field:opacity-100 absolute -right-8 transition-opacity" onClick={() => startEditing('bio', profile?.bio || '안녕하세요! 반갑습니다.')}>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
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
                    disabled={isPending}
                  >
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-offset-background"
                    disabled={isPending}
                  >
                    {isPending ? (
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
                disabled={isPending}
              >
                취소
              </Button>
              <Button 
                type="button" 
                variant="destructive"
                onClick={onDelete}
                className="rounded-xl flex-1 max-w-[120px] bg-red-600 hover:bg-red-700 text-white shadow-sm"
                disabled={isPending}
              >
                {isPending ? (
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
                          disabled={isPending}
                        />
                        <Input
                          {...register("url")}
                          placeholder="주소 (URL)"
                          autoComplete="url"
                          className={`h-9 text-sm bg-background/50 ${errors.url ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          disabled={isPending}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button type="submit" size="icon" className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white" disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-muted" onClick={() => { setEditingLink(null); reset(); }} disabled={isPending}>
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
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block"
                      onClick={() => handleLinkClick(link.id.toString())}
                    >
                      <Card className="transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg border border-border/50 bg-card/60 backdrop-blur-md overflow-hidden relative">
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 group-hover:w-full" />
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-muted/20 p-1.5 flex items-center justify-center border border-border/50 shrink-0 group-hover:bg-background transition-colors">
                              {link.faviconUrl ? (
                                <img src={link.faviconUrl} alt={`${link.title} 파비콘`} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-icon'); }} />
                              ) : (
                                <span className="text-xs text-muted-foreground font-semibold">?</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <h2 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {link.title}
                              </h2>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {link.url.replace(/^(https?:\/\/)?(www\.)?/, '')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center shrink-0">
                            <div className="flex items-center gap-1 bg-muted/40 px-2.5 py-1 rounded-full border border-border/50 transition-all duration-300 group-hover:opacity-0 group-hover:scale-95">
                              <MousePointer2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-mono font-bold text-foreground">
                                {((link as any).clickCount || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1.5 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 z-20 pointer-events-none group-hover:pointer-events-auto">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/90 hover:bg-background border border-border/50 shadow-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(link); }} disabled={isPending}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/90 hover:bg-red-50 border border-border/50 shadow-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmDelete(link); }} disabled={isPending}>
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
