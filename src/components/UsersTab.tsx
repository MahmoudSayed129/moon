import { useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Edit, Plus, UserPlus } from 'lucide-react';

const UsersTab = () => {
  const { users, isLoading, addUser, updateUserPassword, deleteUser } = useUsers();
  const { toast } = useToast();
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'employee' as 'supervisor' | 'employee',
    employeeCode: '',
    commissionRate: '0',
  });
  const [editingUser, setEditingUser] = useState<{ id: string; newPassword: string } | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast({
        title: 'بيانات ناقصة',
        description: 'اسم المستخدم وكلمة المرور مطلوبين',
        variant: 'destructive',
      });
      return;
    }

    const result = await addUser(
      newUser.username.trim(),
      newUser.password,
      newUser.role,
      newUser.employeeCode.trim() || undefined,
      Number(newUser.commissionRate || 0)
    );

    if (result.success) {
      toast({
        title: 'تمت إضافة المستخدم',
        description: `تمت إضافة ${newUser.username} بصلاحية ${getRoleLabel(newUser.role)}`,
      });
      setNewUser({
        username: '',
        password: '',
        role: 'employee',
        employeeCode: '',
        commissionRate: '0',
      });
      setIsAddDialogOpen(false);
    } else {
      toast({
        title: 'فشلت إضافة المستخدم',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editingUser.newPassword.trim()) {
      toast({
        title: 'بيانات ناقصة',
        description: 'كلمة المرور مطلوبة',
        variant: 'destructive',
      });
      return;
    }

    const result = await updateUserPassword(editingUser.id, editingUser.newPassword);

    if (result.success) {
      toast({
        title: 'تم تحديث كلمة المرور',
        description: 'كلمة مرور المستخدم اتغيّرت بنجاح',
      });
      setEditingUser(null);
      setIsEditDialogOpen(false);
    } else {
      toast({
        title: 'فشل تحديث كلمة المرور',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`متأكد إنك عايز تحذف المستخدم "${username}"؟`)) return;

    const result = await deleteUser(userId);

    if (result.success) {
      toast({
        title: 'تم حذف المستخدم',
        description: `المستخدم ${username} اتحذف`,
      });
    } else {
      toast({
        title: 'فشل حذف المستخدم',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'مدير عام';
      case 'supervisor':
        return 'مشرف';
      case 'employee':
        return 'موظف';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'supervisor':
        return 'bg-blue-100 text-blue-800';
      case 'employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-sm sm:text-base">جاري تحميل المستخدمين...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">إدارة المستخدمين</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 ml-2" />
              إضافة مستخدم
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>إضافة مستخدم جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">اسم المستخدم</Label>
                <Input
                  id="new-username"
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                  placeholder="اكتب اسم المستخدم"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  placeholder="اكتب كلمة المرور"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">الصلاحية</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'supervisor' | 'employee') =>
                    setNewUser({ ...newUser, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختار الصلاحية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                    <SelectItem value="employee">موظف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-employee-code">كود الموظف</Label>
                <Input
                  id="new-employee-code"
                  type="text"
                  value={newUser.employeeCode}
                  onChange={(e) => setNewUser({ ...newUser, employeeCode: e.target.value })}
                  placeholder="اختياري - كود لحساب العمولة"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-commission-rate">نسبة العمولة %</Label>
                <Input
                  id="new-commission-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newUser.commissionRate}
                  onChange={(e) =>
                    setNewUser({ ...newUser, commissionRate: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <Button type="submit" className="w-full">
                <UserPlus className="h-4 w-4 ml-2" />
                إضافة المستخدم
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm sm:text-base truncate">{user.username}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${getRoleBadgeColor(user.role)}`}
                  >
                    {getRoleLabel(user.role)}
                  </span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingUser({ id: user.id, newPassword: '' });
                      setIsEditDialogOpen(true);
                    }}
                    className="flex-1 sm:flex-none"
                  >
                    <Edit className="h-4 w-4 sm:mr-0 ml-2" />
                    <span className="sm:hidden">تعديل</span>
                  </Button>
                  {user.role !== 'super_admin' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      className="flex-1 sm:flex-none"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-0 ml-2" />
                      <span className="sm:hidden">حذف</span>
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                <p>تاريخ الإنشاء: {new Date(user.created_at).toLocaleDateString('ar-EG')}</p>
                <p>آخر تحديث: {new Date(user.updated_at).toLocaleDateString('ar-EG')}</p>
                <p>كود الموظف: {user.employee_code || 'غير محدد'}</p>
                <p>نسبة العمولة: {(user.commission_rate || 0).toFixed(2)}%</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
            مفيش مستخدمين لسه. ضيف مستخدم جديد.
          </div>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-password">كلمة المرور الجديدة</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editingUser.newPassword}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, newPassword: e.target.value })
                  }
                  required
                  placeholder="اكتب كلمة المرور الجديدة"
                />
              </div>
              <Button type="submit" className="w-full">
                حفظ كلمة المرور
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersTab;
