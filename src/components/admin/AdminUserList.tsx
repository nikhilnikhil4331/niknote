import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, XCircle, Ban, Trash2, 
  ChevronDown, ChevronUp, User, Calendar,
  Search, Filter, Smartphone, Monitor
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserData {
  id: string;
  display_name: string | null;
  created_at: string;
  is_premium: boolean;
  is_banned?: boolean;
  email?: string;
  last_login?: string;
  pages_created?: number;
  exports?: number;
  device?: string;
}

interface AdminUserListProps {
  users: UserData[];
  loading?: boolean;
  onTogglePremium: (userId: string, currentStatus: boolean) => void;
  onBanUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onSelectUser?: (user: UserData) => void;
}

type FilterType = 'all' | 'premium' | 'free';

export const AdminUserList: React.FC<AdminUserListProps> = ({
  users,
  loading,
  onTogglePremium,
  onBanUser,
  onDeleteUser,
  onSelectUser,
}) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'ban' | 'delete';
    userId: string;
    userName: string;
  } | null>(null);

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      (user.display_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filter === 'all' || 
      (filter === 'premium' && user.is_premium) ||
      (filter === 'free' && !user.is_premium);

    return matchesSearch && matchesFilter;
  });

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    
    if (confirmAction.type === 'ban') {
      onBanUser(confirmAction.userId);
    } else {
      onDeleteUser(confirmAction.userId);
    }
    setConfirmAction(null);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <User className="w-4 h-4" />
              User Management ({filteredUsers.length})
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
                <SelectTrigger className="w-28 h-9">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] sm:h-[500px]">
            <div className="p-3 sm:p-4 space-y-2">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No users match your search' : 'No users found'}
                </div>
              ) : (
                filteredUsers.map((userData, index) => {
                  const isExpanded = expandedUser === userData.id;
                  
                  return (
                    <motion.div
                      key={userData.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="rounded-xl bg-secondary/30 overflow-hidden"
                    >
                      {/* Main Row */}
                      <div 
                        className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : userData.id)}
                      >
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1"
                          onClick={(e) => {
                            if (onSelectUser) {
                              e.stopPropagation();
                              onSelectUser(userData);
                            }
                          }}
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-accent-rose">
                              {(userData.display_name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {userData.display_name || 'Unknown User'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant={userData.is_premium ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {userData.is_premium ? 'Premium' : 'Free'}
                              </Badge>
                              {userData.is_banned && (
                                <Badge variant="destructive" className="text-xs">Banned</Badge>
                              )}
                              {userData.device && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  {userData.device === 'mobile' ? (
                                    <Smartphone className="w-3 h-3" />
                                  ) : (
                                    <Monitor className="w-3 h-3" />
                                  )}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {formatDate(userData.created_at)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Actions */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border/50"
                          >
                            <div className="p-3 sm:p-4 space-y-3">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                Joined {formatDate(userData.created_at)}
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  variant={userData.is_premium ? 'destructive' : 'default'}
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePremium(userData.id, userData.is_premium);
                                  }}
                                >
                                  {userData.is_premium ? (
                                    <>
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Revoke
                                    </>
                                  ) : (
                                    <>
                                      <Crown className="w-3 h-3 mr-1" />
                                      Grant
                                    </>
                                  )}
                                </Button>
                                
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({
                                      type: 'ban',
                                      userId: userData.id,
                                      userName: userData.display_name || 'this user',
                                    });
                                  }}
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Ban
                                </Button>
                                
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({
                                      type: 'delete',
                                      userId: userData.id,
                                      userName: userData.display_name || 'this user',
                                    });
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'ban' ? 'Ban User' : 'Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.userName}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction}
              className={confirmAction?.type === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirmAction?.type === 'ban' ? 'Ban User' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
