import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DEMO_ACCOUNTS } from '@/lib/demo-seed';
import { resetDemoData } from '@/lib/local-db';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const signIn = async (nextUsername: string, nextPassword: string) => {
    setIsLoading(true);

    const result = await login(nextUsername, nextPassword);

    if (result.success) {
      toast({
        title: 'تم تسجيل الدخول',
        description: 'أهلاً بيك في مون ستور',
      });
    } else {
      toast({
        title: 'فشل تسجيل الدخول',
        description: result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(username, password);
  };

  const handleDemoLogin = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    signIn(account.username, account.password);
  };

  const handleResetDemo = () => {
    if (!window.confirm('هترجع كل بيانات الديمو لحالتها الأصلية وأي تعديلات هتتمسح. تكمل؟')) return;
    resetDemoData();
    toast({ title: 'تمت إعادة ضبط بيانات الديمو' });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(143,76,214,0.25),_transparent_35%),linear-gradient(180deg,#fbf7ff_0%,#f4effc_100%)] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#dcc8f7] shadow-2xl shadow-[#8f4cd633]">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-black tracking-[0.3em] text-[#4d1f76]">
            MO<span className="text-[#7b22cc]">☾</span>N
          </CardTitle>
          <CardDescription>تسجيل الدخول إلى مون ستور</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          <div className="mt-6 space-y-3 border-t border-[#ece3f9] pt-5">
            <p className="text-center text-sm font-semibold text-[#4d1f76]">حسابات الديمو</p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  disabled={isLoading}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#dcc8f7] bg-[#faf6ff] px-3 py-2 text-sm transition-colors hover:bg-[#f1e7fd] disabled:opacity-60"
                >
                  <span className="font-medium text-[#4d1f76]">{account.label}</span>
                  <span className="font-mono text-xs text-gray-500" dir="ltr">
                    {account.username} / {account.password}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500">
              نسخة تجريبية: كل البيانات محفوظة على الجهاز ده بس.{' '}
              <button
                type="button"
                onClick={handleResetDemo}
                className="font-medium text-[#7b22cc] underline-offset-2 hover:underline"
              >
                إعادة ضبط البيانات
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
