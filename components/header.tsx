"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart3, ChevronDown, Copy, ExternalLink, LogIn, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export function Header() {
  const { user, login, logout, loading } = useAuth();

  // 프로필 데이터 조회 (username 포함)
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: async () => {
      if (!user) return null;
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      return docSnap.exists() ? docSnap.data() : null;
    },
    enabled: !!user,
  });

  const displayUsername = profile?.username || user?.email?.split('@')[0] || "";

  if (loading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-full items-center justify-between px-4">
          <div className="text-xl font-bold">Mylink</div>
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-full items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight">Mylink</Link>
        
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:flex rounded-full px-4 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                <Link href={`/${displayUsername}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  내 페이지
                </Link>
              </Button>

              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-blue-200">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="프로필" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <span className="hidden text-sm font-medium sm:inline-block">
                    <span className="font-bold text-blue-600">{user.displayName}</span>님
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${displayUsername}`} className="cursor-pointer flex w-full items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>내 페이지 미리보기</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/stats" className="cursor-pointer flex w-full items-center text-purple-600 focus:text-purple-600 focus:bg-purple-50">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>클릭 통계 보기</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    const url = `${window.location.origin}/${displayUsername}`;
                    navigator.clipboard.writeText(url);
                    toast.success("링크가 복사되었습니다 ✨", {
                      description: "이제 원하는 곳에 붙여넣어 공유해 보세요!",
                    });
                  }}
                  className="cursor-pointer"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  <span>내 페이지 링크 복사</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={logout}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <Button 
              variant="default" 
              size="sm" 
              onClick={login}
              className="flex items-center gap-2 rounded-full px-5"
            >
              <LogIn className="h-4 w-4" />
              <span>Google로 로그인</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
