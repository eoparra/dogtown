import { useState, useEffect } from 'react';
import { admin } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { User, Dog } from '@/types';
import { format } from 'date-fns';

interface UserWithCount extends User {
  _count: { dogs: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDogs, setUserDogs] = useState<Record<string, Dog[]>>({});

  useEffect(() => {
    admin.getUsers()
      .then(({ users }) => setUsers(users))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }

    setExpandedUser(userId);

    if (!userDogs[userId]) {
      try {
        const { dogs } = await admin.getUserDogs(userId);
        setUserDogs((prev) => ({ ...prev, [userId]: dogs }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users Management</h1>
        <p className="text-muted-foreground">View and manage registered users</p>
      </div>

      {users.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">No users registered yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(user.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold">{user._count.dogs} dogs</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      {expandedUser === user.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedUser === user.id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-3">Dogs</h4>
                    {userDogs[user.id] ? (
                      userDogs[user.id].length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {userDogs[user.id].map((dog) => (
                            <div key={dog.id} className="border rounded-lg p-3">
                              <div className="font-medium">{dog.name}</div>
                              <div className="text-sm text-muted-foreground">{dog.breed}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {dog.age} years, {dog.weight} kg
                              </div>
                              {dog.vaccinationInfo ? (
                                <Badge variant="success" className="mt-2">
                                  Vaccinated
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="mt-2">
                                  No vaccination info
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No dogs registered</p>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        Loading dogs...
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
