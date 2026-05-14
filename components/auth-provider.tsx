"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Firestore에서 해당 사용자의 문서가 있는지 확인
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // 최초 로그인(회원가입) 시, 기본 정보 저장
        await setDoc(userRef, {
          uid: user.uid, // 임시 고유 ID로 uid 사용
          email: user.email || "",
          username: user.displayName || "사용자",
          displayName: user.email ? user.email.split('@')[0] : "user",
          bio: "안녕하세요! 반갑습니다.",
          photoUrl: user.photoURL || "",
          createdAt: serverTimestamp(),
        });
      } else {
        // 기존 데이터가 있는 경우에도 변경된 정책에 맞게 필드 업데이트
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || "",
          username: user.displayName || "사용자",
          displayName: user.email ? user.email.split('@')[0] : "user",
        }, { merge: true });
      }
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
