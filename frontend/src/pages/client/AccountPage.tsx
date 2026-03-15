import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { auth as authApi } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, Star, User, Lock, AlertCircle } from 'lucide-react';

export default function AccountPage() {
  const { user, updateProfile } = useAuth();

  // Profile form state
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile and security settings</p>
        </div>
        {user?.userType === 'PREFERENT' && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-2">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span className="text-sm font-semibold">Preferent Member — 10% off all bookings</span>
          </div>
        )}
      </div>

      {/* Account Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 rounded-full p-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{user?.name}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={user?.userType === 'PREFERENT' ? 'default' : 'outline'}>
                  {user?.userType === 'PREFERENT' ? (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Preferent
                    </span>
                  ) : 'Regular'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Input
              id="name"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <p className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground items-center">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
            </div>
            <Input
              id="phone"
              label="Phone Number"
              type="tel"
              placeholder="Optional"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {profileError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Profile updated successfully!
              </div>
            )}

            <Button type="submit" disabled={profileSaving || !name.trim()}>
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <PasswordInput
              id="currentPassword"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <PasswordInput
              id="newPassword"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground -mt-2">
              Minimum 12 characters with uppercase, lowercase, and a number.
            </p>
            <PasswordInput
              id="confirmPassword"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            {passwordError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Password changed successfully! You're still logged in.
              </div>
            )}

            <Button
              type="submit"
              variant="outline"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            >
              {passwordSaving ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
