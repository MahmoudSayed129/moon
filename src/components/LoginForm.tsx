import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(username, password);

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
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
