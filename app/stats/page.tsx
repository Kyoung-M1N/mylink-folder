"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MousePointer2, TrendingUp, BarChart3, Award, ExternalLink, ArrowUpRight } from 'lucide-react';
import { LinkProps } from '@/data/links';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

const chartConfig = {
  clicks: {
    label: "클릭수",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 비로그인 시 메인 페이지로 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  // 링크 목록 및 클릭수 데이터 페칭 (orderBy('clickCount', 'desc'))
  const { data: links = [], isLoading: isLinksLoading } = useQuery({
    queryKey: ['links', user?.uid, 'stats'],
    queryFn: async () => {
      if (!user?.uid) return [];
      const linksRef = collection(db, 'users', user.uid, 'links');
      const q = query(linksRef, orderBy('clickCount', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as LinkProps[];
    },
    enabled: !!user?.uid,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-[calc(100svh-64px)] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 총 클릭수 합산 계산
  const totalClicks = links.reduce((acc, link) => acc + ((link as any).clickCount || 0), 0);

  // 차트용 데이터 가공 (상위 10개 링크 표시)
  const chartData = links.slice(0, 10).map((link, index) => ({
    title: link.title.length > 10 ? `${link.title.substring(0, 10)}...` : link.title,
    fullTitle: link.title,
    clicks: (link as any).clickCount || 0,
    // 상위 3개 막대에 특별한 색상 부여
    fill: index === 0 ? "hsl(221, 83%, 53%)" : index === 1 ? "hsl(230, 80%, 65%)" : index === 2 ? "hsl(240, 75%, 75%)" : "hsl(220, 20%, 85%)",
  }));

  return (
    <div className="relative min-h-[calc(100svh-64px)] w-full bg-background overflow-hidden flex flex-col items-center py-16 px-4 sm:px-6 lg:px-8">
      {/* 배경 장식 효과 */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 w-full max-w-4xl space-y-8">
        {/* 상단 타이틀 영역 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <span>링크 클릭 통계</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              내 링크들이 얼마나 많은 관심을 받고 있는지 실시간으로 확인해보세요.
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/')}
            className="rounded-xl border-border hover:bg-muted/50 self-start sm:self-auto"
          >
            대시보드로 돌아가기
          </Button>
        </div>

        {isLinksLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <Card className="border-border/50 bg-card/60 backdrop-blur-md p-12 text-center shadow-lg rounded-3xl">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <MousePointer2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold">등록된 링크가 없습니다</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                아직 생성된 링크가 없어 통계를 확인할 수 없습니다. 대시보드에서 새로운 링크를 추가해보세요.
              </p>
              <Button onClick={() => router.push('/')} className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                링크 추가하러 가기
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {/* 총 클릭수 요약 카드 */}
            <Card className="border-border/50 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl overflow-hidden rounded-3xl relative">
              <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-100 tracking-wide uppercase flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> 전체 링크 총 합산 클릭수
                  </p>
                  <h2 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
                    {totalClicks.toLocaleString()}
                    <span className="text-2xl sm:text-3xl font-bold text-blue-200 ml-2">회</span>
                  </h2>
                  <p className="text-xs text-blue-100/80 pt-1">
                    총 {links.length}개의 링크에서 발생한 누적 클릭 데이터입니다.
                  </p>
                </div>
                <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
                  <MousePointer2 className="h-8 w-8 text-white" />
                </div>
              </CardContent>
            </Card>

            {/* 차트 영역 */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 sm:p-8 pb-0">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>링크별 클릭 비교 (상위 10개)</span>
                </CardTitle>
                <CardDescription>가장 클릭수가 많은 상위 링크들의 실시간 클릭 분포입니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-6">
                {totalClicks === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border/60 rounded-2xl">
                    <MousePointer2 className="h-8 w-8 mb-2 opacity-40" />
                    <p className="font-semibold text-foreground/70">아직 클릭 기록이 없습니다</p>
                    <p className="text-xs mt-1">링크를 공유하여 방문자들의 클릭을 유도해보세요.</p>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[320px] w-full">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis 
                        dataKey="title" 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: 'currentColor', fontSize: 12 }} 
                        className="text-muted-foreground font-medium"
                      />
                      <YAxis 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: 'currentColor', fontSize: 12 }} 
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <ChartTooltip 
                        cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }} 
                        content={<ChartTooltipContent hideLabel />} 
                      />
                      <Bar dataKey="clicks" radius={[8, 8, 0, 0]} maxBarSize={50}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* 링크별 상세 순위 리스트 */}
            <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 sm:p-8 pb-4 border-b border-border/40">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-600" />
                  <span>인기 링크 랭킹</span>
                </CardTitle>
                <CardDescription>전체 링크의 클릭수 순위와 점유율을 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 divide-y divide-border/40">
                {links.map((link, index) => {
                  const clicks = (link as any).clickCount || 0;
                  const percentage = totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0;
                  
                  return (
                    <div key={link.id as unknown as string} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4 sm:gap-6 group">
                      {/* 순위 뱃지 */}
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {index === 0 ? (
                          <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shadow-sm">
                            <span className="text-sm font-extrabold text-amber-700">1</span>
                          </div>
                        ) : index === 1 ? (
                          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center shadow-sm">
                            <span className="text-sm font-extrabold text-slate-700">2</span>
                          </div>
                        ) : index === 2 ? (
                          <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shadow-sm">
                            <span className="text-sm font-extrabold text-amber-800/60">3</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
                        )}
                      </div>

                      {/* 파비콘 */}
                      <div className="w-10 h-10 rounded-xl bg-muted/50 p-1.5 flex items-center justify-center ring-1 ring-border shadow-sm shrink-0 overflow-hidden">
                        {link.faviconUrl ? (
                          <img 
                            src={link.faviconUrl} 
                            alt="파비콘" 
                            className="w-full h-full object-contain" 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground font-semibold">?</span>
                        )}
                      </div>

                      {/* 링크 정보 및 프로그레스 바 */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-bold text-foreground/90 hover:text-blue-600 truncate flex items-center gap-1 transition-colors"
                          >
                            <span className="truncate">{link.title}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </a>
                          <div className="text-sm font-mono font-bold text-foreground flex items-center gap-1 shrink-0">
                            <span>{clicks.toLocaleString()}</span>
                            <span className="text-xs font-normal text-muted-foreground">({percentage}%)</span>
                          </div>
                        </div>

                        {/* 프로그레스 바 */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              index === 0 ? "bg-blue-600" : index === 1 ? "bg-blue-500/80" : index === 2 ? "bg-blue-400/80" : "bg-muted-foreground/40"
                            }`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
