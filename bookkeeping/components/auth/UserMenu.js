"use client";
import { useAuth } from '../../lib/auth-context';
import { LogOut, User, Settings } from 'lucide-react';

export default function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {user.photoURL ? (
          <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
            <User className="w-5 h-5" />
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{user.displayName || user.email}</p>
          <p className="text-xs text-gray-500">Signed in</p>
        </div>
      </div>
      <button
        onClick={signOut}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        title="Sign Out"
      >
        <LogOut className="w-5 h-5" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
}
