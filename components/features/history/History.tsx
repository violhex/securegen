'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Trash2, 
  Search, 
  Key, 
  Shield, 
  User, 
  Calendar,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { useGenerator } from '@/hooks/useGenerator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GeneratedItem } from '@/types';

const typeConfig = {
  password: {
    icon: Key,
    label: 'Password',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    iconColor: 'text-blue-600',
  },
  passphrase: {
    icon: Shield,
    label: 'Passphrase',
    color: 'bg-green-500/10 text-green-600 border-green-200',
    iconColor: 'text-green-600',
  },
  username: {
    icon: User,
    label: 'Username',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    iconColor: 'text-purple-600',
  },
};

interface FilterState {
  password: boolean;
  passphrase: boolean;
  username: boolean;
}

export function History() {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    password: true,
    passphrase: true,
    username: true,
  });

  const { history, removeFromHistory, clearHistory } = useAppStore();
  const { copyToClipboard } = useGenerator();

  const filteredHistory = useMemo(() => {
    const filtered = history.filter((item) => {
      // Type filter
      if (!filters[item.type]) return false;
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.value.toLowerCase().includes(term) ||
          item.type.toLowerCase().includes(term) ||
          format(new Date(item.createdAt), 'PPp').toLowerCase().includes(term)
        );
      }
      
      return true;
    });

    return filtered;
  }, [history, filters, searchTerm]);

  const handleCopy = async (item: GeneratedItem) => {
    const success = await copyToClipboard(item.value);
    if (success) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStrengthInfo = (strength?: number) => {
    if (!strength) return null;
    
    if (strength < 30) return { label: 'Weak', color: 'strength-weak', icon: AlertCircle };
    if (strength < 60) return { label: 'Fair', color: 'strength-fair', icon: AlertCircle };
    if (strength < 80) return { label: 'Good', color: 'strength-good', icon: CheckCircle };
    return { label: 'Strong', color: 'strength-strong', icon: CheckCircle };
  };

  const toggleFilter = (type: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Generation History
        </h1>
        <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          View and manage your recently generated passwords, passphrases, and usernames. 
          Keep track of your security credentials with ease.
        </p>
      </motion.header>

      {/* Controls */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
      >
        {/* Search and Filter Bar */}
        <Card className="card-elevated">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 card-flat"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Filter Toggles */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Filters:</span>
                  </div>

                  <div className="grid grid-cols-3 sm:flex sm:items-center gap-3 sm:gap-4">
                    {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((type) => {
                      const config = typeConfig[type];
                      const Icon = config.icon;
                      
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <Switch
                            id={`filter-${type}`}
                            checked={filters[type]}
                            onCheckedChange={() => toggleFilter(type)}
                            className="data-[state=checked]:bg-primary"
                          />
                          <Label 
                            htmlFor={`filter-${type}`}
                            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium cursor-pointer"
                          >
                            <Icon className={cn("w-3 h-3 sm:w-3.5 sm:h-3.5", config.iconColor)} />
                            <span className="hidden sm:inline">{config.label}</span>
                            <span className="sm:hidden">{config.label.slice(0, 4)}</span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearHistory}
                    disabled={history.length === 0}
                    className="card-flat"
                  >
                    <Trash2 className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Clear All</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="card-flat">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total</p>
                  <p className="text-lg sm:text-xl font-semibold">{history.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((type) => {
            const config = typeConfig[type];
            const Icon = config.icon;
            const count = history.filter(item => item.type === type).length;
            
            return (
              <Card key={type} className="card-flat">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn("p-1.5 sm:p-2 rounded-lg", `${config.iconColor.replace('text-', 'text-')} bg-current/10`)}>
                      <Icon className={cn("w-3 h-3 sm:w-4 sm:h-4", config.iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                        <span className="hidden sm:inline">{config.label}s</span>
                        <span className="sm:hidden">{config.label.slice(0, 4)}</span>
                      </p>
                      <p className="text-lg sm:text-xl font-semibold">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.section>

      {/* History List */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-4"
      >
        {filteredHistory.length === 0 ? (
          <Card className="card-flat">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                {history.length === 0 ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Calendar className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No History Yet</h3>
                      <p className="text-muted-foreground">
                        Start generating passwords, passphrases, and usernames to see them here.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                      <p className="text-muted-foreground">
                        Try adjusting your search term or filter settings.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredHistory.map((item, index) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              const isVisible = visibleItems.has(item.id);
              const strengthInfo = getStrengthInfo(item.strength);
              const StrengthIcon = strengthInfo?.icon;
              const isCopied = copiedId === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ 
                    duration: 0.2, 
                    delay: Math.min(index * 0.02, 0.1),
                    ease: [0.4, 0, 0.2, 1] 
                  }}
                >
                  <Card className="card-elevated hover:shadow-lg transition-all duration-200">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Type Icon */}
                        <div className={cn("p-2 sm:p-3 rounded-xl flex-shrink-0 bg-current/10", config.iconColor)}>
                          <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", config.iconColor)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 sm:gap-4">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className={cn("text-xs font-medium", config.color)}>
                                  {config.label}
                                </Badge>
                                {strengthInfo && (
                                  <Badge 
                                    variant="secondary" 
                                    className={cn("text-xs font-medium flex items-center gap-1", strengthInfo.color)}
                                  >
                                    {StrengthIcon && <StrengthIcon className="w-3 h-3" />}
                                    <span className="hidden sm:inline">{strengthInfo.label}</span>
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                                {format(new Date(item.createdAt), window.innerWidth < 640 ? 'MMM d, h:mm a' : 'PPp')}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleVisibility(item.id)}
                                className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted"
                              >
                                {isVisible ? (
                                  <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                                ) : (
                                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(item)}
                                className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted"
                              >
                                {isCopied ? (
                                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromHistory(item.id)}
                                className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Value */}
                          <div className="space-y-2">
                            <div className="font-mono text-xs sm:text-sm bg-muted/50 rounded-lg p-2 sm:p-3 border break-all">
                              {isVisible ? (
                                <span className="select-all">{item.value}</span>
                              ) : (
                                <span className="select-none">
                                  {'•'.repeat(Math.min(item.value.length, window.innerWidth < 640 ? 15 : 20))}
                                  {item.value.length > (window.innerWidth < 640 ? 15 : 20) && '...'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </motion.section>
    </div>
  );
} 