import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { isSuperAdminEmail, type AccountStatus } from "./constants";

interface AuthState {
  user: User | null;
  status: AccountStatus | null;
  isSuperAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function ensureProfile(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      status: "pending" satisfies AccountStatus,
      createdAt: serverTimestamp(),
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      unsubProfile?.();
      unsubProfile = undefined;
      setUser(nextUser);

      if (!nextUser) {
        setStatus(null);
        setLoading(false);
        return;
      }

      try {
        await ensureProfile(nextUser);
      } catch (err) {
        console.error("Failed to ensure user profile", err);
      }

      unsubProfile = onSnapshot(
        doc(db, "users", nextUser.uid),
        (snap) => {
          const data = snap.data();
          setStatus((data?.status as AccountStatus | undefined) ?? "pending");
          setLoading(false);
        },
        (err) => {
          console.error("Profile subscription error", err);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const isSuperAdmin = isSuperAdminEmail(user?.email);
    return {
      user,
      status: isSuperAdmin ? "approved" : status,
      isSuperAdmin,
      loading,
      signInWithGoogle: async () => {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      signInWithEmail: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      registerWithEmail: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    };
  }, [user, status, loading]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
