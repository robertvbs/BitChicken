import { Injectable, computed, signal } from '@angular/core';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, getIdToken, User, Auth } from 'firebase/auth';
import { environment } from '../../../environments/environment';

function resolveApp(): FirebaseApp {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp(environment.firebase);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(resolveApp());

  private readonly _currentUser = signal<User | null>(null);
  private readonly _initialized = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly initialized = this._initialized.asReadonly();

  constructor() {
    onIdTokenChanged(this.auth, (user) => {
      this._currentUser.set(user);
      if (!this._initialized()) {
        this._initialized.set(true);
      }
    });
  }

  async signUp(email: string, password: string, nickname: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName: nickname });
    await getIdToken(credential.user, true);
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  async getIdToken(): Promise<string | null> {
    const user = this._currentUser();
    if (!user) return null;
    return getIdToken(user);
  }
}
