'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <header className="bg-[#1E293B] border-b border-slate-800">
        <div className="px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-slate-400 mt-1">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Account Information */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Account Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white">
                  {user?.email || 'Not available'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">User ID</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 font-mono text-sm">
                  {user?.id || 'Not available'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Account Created</label>
                <div className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Not available'}
                </div>
              </div>
            </div>
          </div>

          {/* Subscription & Plan */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Subscription & Plan</h2>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl font-bold text-white">Free Plan</div>
                <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
              <p className="text-slate-400">You're currently on the free plan with access to basic features.</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited projects</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Compliance scanning</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Basic reports</span>
              </div>
            </div>

            <button className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20">
              Upgrade to Pro
            </button>
          </div>

          {/* Preferences */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Preferences</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Email Notifications</div>
                  <div className="text-sm text-slate-400">Receive alerts for critical violations</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Weekly Digest</div>
                  <div className="text-sm text-slate-400">Summary of compliance status</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Security</h2>

            <div className="space-y-4">
              <div>
                <div className="font-medium text-white mb-2">Password</div>
                <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                  Change password →
                </button>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <div className="font-medium text-white mb-3">Danger Zone</div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
