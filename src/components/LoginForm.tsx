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
        description: 'أهلاً بيك في رافين ستور',
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,51,0,0.10),_transparent_35%),linear-gradient(180deg,#fafafa_0%,#efefef_100%)] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-neutral-200 shadow-2xl shadow-black/10">
        <CardHeader className="text-center">
          <CardTitle className="flex justify-center py-2">
            <img src="/ravin-logo.png" alt="Ravin" className="h-12 w-auto" />
          </CardTitle>
          <CardDescription>تسجيل الدخول إلى رافين ستور</CardDescription>
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

          <div className="mt-6 space-y-3 border-t border-neutral-200 pt-5">
            <p className="text-center text-sm font-semibold text-neutral-900">حسابات الديمو</p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  disabled={isLoading}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm transition-colors hover:border-brand-200 hover:bg-brand-50 disabled:opacity-60"
                >
                  <span className="font-medium text-neutral-900">{account.label}</span>
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
                className="font-medium text-brand-600 underline-offset-2 hover:underline"
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
