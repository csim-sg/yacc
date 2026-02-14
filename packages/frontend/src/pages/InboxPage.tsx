/**
 * Inbox Page
 * Main conversation list view with hideable sidebar
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { UnreadBadge } from '../components/UnreadBadge';
import { useUnreadBadges } from '../hooks/useUnreadBadges';
import {
  conversationsService,
  type ConversationListItem,
  type ConversationStatus,
  type ConversationPriority,
  type Phase1ChannelType,
  type ListConversationsResponse,
  type ConversationTag,
  PHASE1_CHANNELS,
} from '../services/conversations.service';

const CHANNEL_LABELS: Record<Phase1ChannelType, string> = {
  telegram: 'Telegram',
  irc: 'IRC',
};

const PRIORITY_BADGE: Record<ConversationPriority, string> = {
  low: 'badge-ghost',
  normal: 'badge-info',
  high: 'badge-warning',
  urgent: 'badge-error',
};

const STATUS_BADGE: Record<ConversationStatus, string> = {
  open: 'badge-success',
  pending: 'badge-warning',
  resolved: 'badge-neutral',
};

const STATUS_VALUES: ConversationStatus[] = ['open', 'pending', 'resolved'];
const PRIORITY_VALUES: ConversationPriority[] = ['low', 'normal', 'high', 'urgent'];
const CHANNEL_VALUES: Phase1ChannelType[] = [...PHASE1_CHANNELS];

export function InboxPage() {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useAuthStore();
  const { markAsRead } = useUnreadBadges();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  const [page, setPage] = useState(1);

  /**
   * Handle conversation click - mark as read and navigate
   */
  const handleConversationClick = useCallback(
    (conversationId: string) => {
      if (conversationId) {
        markAsRead(conversationId);
      }
      navigate(`/conversations/${conversationId}`);
    },
    [markAsRead, navigate]
  );
  const [channel, setChannel] = useState<Phase1ChannelType | 'all'>('all');
  const [status, setStatus] = useState<ConversationStatus | 'all'>('all');
  const [priority, setPriority] = useState<ConversationPriority | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    const checkScreenSize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (initializedFromUrl) {
      return;
    }

    const pageParam = Number(searchParams.get('page') || 1);
    const channelParam = searchParams.get('channel');
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const searchParam = searchParams.get('search');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    const unreadParam = searchParams.get('unread');

    setPage(Number.isNaN(pageParam) ? 1 : pageParam);
    setChannel(CHANNEL_VALUES.includes(channelParam as Phase1ChannelType) ? (channelParam as Phase1ChannelType) : 'all');
    setStatus(STATUS_VALUES.includes(statusParam as ConversationStatus) ? (statusParam as ConversationStatus) : 'all');
    setPriority(PRIORITY_VALUES.includes(priorityParam as ConversationPriority) ? (priorityParam as ConversationPriority) : 'all');
    setSearch(searchParam || '');
    setSearchInput(searchParam || '');
    setDateFrom(dateFromParam || '');
    setDateTo(dateToParam || '');
    setUnreadOnly(unreadParam === 'true');

    setInitializedFromUrl(true);
  }, [searchParams, initializedFromUrl]);

  useEffect(() => {
    if (!initializedFromUrl) {
      return;
    }

    const params = new URLSearchParams();

    if (page > 1) {
      params.set('page', String(page));
    }
    if (channel !== 'all') {
      params.set('channel', channel);
    }
    if (status !== 'all') {
      params.set('status', status);
    }
    if (priority !== 'all') {
      params.set('priority', priority);
    }
    if (search) {
      params.set('search', search);
    }
    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      params.set('dateTo', dateTo);
    }
    if (unreadOnly) {
      params.set('unread', 'true');
    }

    setSearchParams(params, { replace: true });
  }, [
    page,
    channel,
    status,
    priority,
    search,
    dateFrom,
    dateTo,
    unreadOnly,
    initializedFromUrl,
    setSearchParams,
  ]);

  useEffect(() => {
    if (initializedFromUrl) {
      setPage(1);
    }
  }, [channel, status, priority, search, dateFrom, dateTo, unreadOnly, initializedFromUrl]);

  const listParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      sortBy: 'lastActivity' as const,
      sortOrder: 'desc' as const,
      ...(channel !== 'all' ? { channel } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(priority !== 'all' ? { priority } : {}),
      ...(search ? { search } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(unreadOnly ? { unread: true } : {}),
    }),
    [page, pageSize, channel, status, priority, search, dateFrom, dateTo, unreadOnly]
  );

  const {
    data: conversationsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<ListConversationsResponse, { error?: string; message?: string }>({
    queryKey: ['conversations', listParams],
    queryFn: () => conversationsService.list(listParams),
    placeholderData: (previous: ListConversationsResponse | undefined) => previous ?? undefined,
  });

   const conversations: ConversationListItem[] = conversationsData?.data ?? [];
   const totalCount = conversationsData?.total ?? 0;
   const responsivePageSize = conversationsData?.pageSize ?? 20;
   const totalPages = Math.ceil(totalCount / responsivePageSize);
   const errorMessage = error?.error || error?.message || 'Failed to load conversations';

  useEffect(() => {
    if (error && error.error === 'Authorization is required') {
      console.warn('Authorization failed for conversations list. Token may be missing or expired.');
    }
  }, [error]);

  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; onClear: () => void }> = [];

    if (channel !== 'all') {
      filters.push({
        label: `Channel: ${CHANNEL_LABELS[channel]}`,
        onClear: () => setChannel('all'),
      });
    }

    if (status !== 'all') {
      filters.push({
        label: `Status: ${status}`,
        onClear: () => setStatus('all'),
      });
    }

    if (priority !== 'all') {
      filters.push({
        label: `Priority: ${priority}`,
        onClear: () => setPriority('all'),
      });
    }

    if (search) {
      filters.push({
        label: `Search: ${search}`,
        onClear: () => {
          setSearch('');
          setSearchInput('');
        },
      });
    }

    if (dateFrom || dateTo) {
      filters.push({
        label: `Date: ${dateFrom || 'Any'} → ${dateTo || 'Any'}`,
        onClear: () => {
          setDateFrom('');
          setDateTo('');
        },
      });
    }

    if (unreadOnly) {
      filters.push({
        label: 'Unread only',
        onClear: () => setUnreadOnly(false),
      });
    }

    return filters;
  }, [channel, status, priority, search, dateFrom, dateTo, unreadOnly]);

  const handleLogout = async () => {
    await logout();
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSearchSubmit = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  const handleClearFilters = () => {
    setChannel('all');
    setStatus('all');
    setPriority('all');
    setSearch('');
    setSearchInput('');
    setDateFrom('');
    setDateTo('');
    setUnreadOnly(false);
  };

  const handleChannelSelect = (value: Phase1ChannelType | 'all') => {
    setChannel(value);

    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const formatTimestamp = (value?: string) => {
    if (!value) {
      return 'No activity';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No activity';
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-base-200">
      <div className="navbar bg-primary text-primary-content shadow-lg fixed top-0 left-0 right-0 z-50 min-h-[64px] px-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <button
            onClick={toggleSidebar}
            className="btn btn-ghost btn-sm sm:btn-md btn-square flex-shrink-0 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 sm:w-6 sm:h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-content text-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-lg sm:text-xl">Y</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold leading-tight truncate">YACC Inbox</h1>
              <p className="text-xs text-primary-content/70 hidden md:block">Omni-channel Social Inbox</p>
            </div>
          </div>
        </div>

        <div className="flex-none flex-shrink-0">
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle btn-sm sm:btn-md avatar placeholder"
            >
              <div className="bg-primary-content text-primary rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                <span className="text-base sm:text-lg font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="mt-3 z-[60] p-2 shadow menu menu-sm dropdown-content bg-base-100 text-base-content rounded-box w-56"
            >
              <li className="menu-title px-3 py-2">
                <span className="text-sm font-semibold">{user?.name}</span>
              </li>
              <li>
                <a className="text-xs py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {user?.email}
                </a>
              </li>
              <li>
                <a className="text-xs py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  <span className="capitalize">{user?.role?.replace('_', ' ')}</span>
                </a>
              </li>
              <div className="divider my-1"></div>
              <li>
                <button
                  onClick={handleLogout}
                  disabled={authLoading}
                  className="text-error py-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  {authLoading ? 'Logging out...' : 'Logout'}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-1 pt-16 overflow-hidden" style={{ paddingTop: '64px' }}>
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            style={{ top: '64px' }}
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed left-0 bottom-0 bg-base-100 shadow-xl transition-transform duration-300 ease-in-out z-40 
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
          style={{ width: '280px', top: '64px' }}
        >
          <div className="h-full overflow-y-auto">
            <div className="p-4 border-b border-base-300 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary text-primary-content rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-xl">Y</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-tight truncate">YACC</h2>
                  <p className="text-xs text-base-content/60">Inbox Menu</p>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="btn btn-ghost btn-sm btn-circle ml-auto flex-shrink-0"
                  aria-label="Close sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <ul className="menu p-4 w-full">
              <li className="menu-title">
                <span>Navigation</span>
              </li>
              <li>
                <button
                  className={`justify-between ${channel === 'all' ? 'active' : ''}`}
                  onClick={() => handleChannelSelect('all')}
                >
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                    </svg>
                    Inbox
                  </div>
                  <span className="badge badge-sm badge-primary">{totalCount}</span>
                </button>
              </li>
              <li>
                <button className="justify-start" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                  Tags
                </button>
              </li>
              <li>
                <button className="justify-start" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                  Assigned to Me
                </button>
              </li>

              <li className="menu-title mt-4">
                <span>Channels</span>
              </li>
              <li>
                <button
                  className={channel === 'all' ? 'active' : ''}
                  onClick={() => handleChannelSelect('all')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                  All Channels
                </button>
              </li>
              <li>
                <button
                  className={channel === 'telegram' ? 'active' : ''}
                  onClick={() => handleChannelSelect('telegram')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
                  </svg>
                  Telegram
                </button>
              </li>
              <li>
                <button
                  className={channel === 'irc' ? 'active' : ''}
                  onClick={() => handleChannelSelect('irc')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  IRC
                </button>
              </li>

              <li className="menu-title mt-4">
                <span>Settings</span>
              </li>
              <li>
                <button className="justify-start" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.220.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.240.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Preferences
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <main
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            sidebarOpen ? 'ml-[280px]' : 'ml-0 lg:ml-[280px]'
          }`}
        >
          <div className="container mx-auto p-4 md:p-6 max-w-7xl">
            <div className="card bg-base-100 shadow-xl mb-6">
              <div className="card-body">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <h2 className="card-title text-2xl">Conversations</h2>
                      {isFetching && !isLoading && (
                        <span className="loading loading-spinner loading-sm text-primary"></span>
                      )}
                    </div>
                    <button className="btn btn-primary btn-sm" disabled>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      New Message
                    </button>
                  </div>

                   <div className="flex flex-col lg:flex-row gap-3">
                     <label className="input input-bordered flex items-center gap-2 flex-1">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-base-content/60">
                         <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 4.5 4.5a7.5 7.5 0 0 0 12.15 12.15Z" />
                       </svg>
                       <input
                         type="text"
                         className="grow"
                         placeholder="Search conversations"
                         value={searchInput}
                         onChange={(event) => setSearchInput(event.target.value)}
                         onKeyDown={handleSearchKeyDown}
                         data-testid="search-input"
                       />
                     </label>
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={handleSearchSubmit}>
                        Search
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                        Clear
                      </button>
                    </div>
                  </div>

                   <div className="flex flex-wrap gap-3">
                     <select
                       className="select select-bordered select-sm"
                       value={channel}
                       onChange={(event) => setChannel(event.target.value as Phase1ChannelType | 'all')}
                       data-testid="channel-filter"
                     >
                       <option value="all">All Channels</option>
                       <option value="telegram">Telegram</option>
                       <option value="irc">IRC</option>
                     </select>

                     <select
                        className="select select-bordered select-sm"
                        value={status}
                        onChange={(event) => setStatus(event.target.value as ConversationStatus | 'all')}
                        data-testid="status-filter"
                      >
                        <option value="all">All Statuses</option>
                       <option value="open">Open</option>
                       <option value="pending">Pending</option>
                       <option value="resolved">Resolved</option>
                     </select>

                    <select
                      className="select select-bordered select-sm"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as ConversationPriority | 'all')}
                    >
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={unreadOnly}
                        onChange={(event) => setUnreadOnly(event.target.checked)}
                      />
                      Unread only
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-base-content/70">From</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                      />
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-base-content/70">To</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                      />
                    </label>

                    {activeFilters.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={handleClearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </div>

                  {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
                        <button
                          key={filter.label}
                          className="badge badge-outline badge-sm gap-1"
                          onClick={filter.onClear}
                        >
                          {filter.label}
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="divider"></div>

                {(isLoading || isFetching) && (
                  <div className="space-y-4" data-testid="conversation-skeleton">
                    {[...Array(3)].map((_, index) => (
                      <div key={`loading-${index}`} className="flex flex-col gap-2">
                        <div className="skeleton h-4 w-1/3"></div>
                        <div className="skeleton h-3 w-2/3"></div>
                        <div className="skeleton h-3 w-1/2"></div>
                        <div className="divider"></div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && error && (
                   <div className="alert alert-error" data-testid="error-message">
                     <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <div className="flex-1">
                       <h3 className="font-semibold">Failed to load conversations</h3>
                       <div className="text-sm opacity-80">{errorMessage}</div>
                     </div>
                     <button className="btn btn-sm" onClick={() => refetch()} data-testid="retry-button">
                       Retry
                     </button>
                   </div>
                 )}

                {!isLoading && !error && conversations.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-16 h-16 text-base-content/30 mb-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-base-content mb-2">No conversations yet</h3>
                    <p className="text-base-content/60 max-w-md">
                      Your inbox is empty. Conversations from connected platforms will appear here when they arrive.
                    </p>
                  </div>
                )}

                {!isLoading && !error && conversations.length > 0 && (
                  <div className="space-y-3">
                    {conversations.map((conversation: ConversationListItem) => (
                      <button
                        key={conversation.id}
                        onClick={() => handleConversationClick(conversation.id)}
                        className="block w-full text-left p-4 rounded-lg border border-base-200 hover:border-primary/40 transition-colors"
                        data-testid="conversation-card"
                        data-conversation-id={conversation.id}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                             <span className="badge badge-outline badge-sm" data-testid="conversation-channel">
                               {CHANNEL_LABELS[conversation.channel as Phase1ChannelType] || conversation.channel}
                             </span>
                             <span className={`badge badge-sm ${STATUS_BADGE[conversation.status]}`} data-testid="conversation-status-badge">
                               {conversation.status}
                             </span>
                             <span className={`badge badge-sm ${PRIORITY_BADGE[conversation.priority]}`}>
                               {conversation.priority}
                             </span>
                             <UnreadBadge count={conversation.unreadCount || 0} />
                           </div>

                          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="flex-1 min-w-0">
                               <h3 className="font-semibold text-base truncate">
                                 {conversation.title || `Thread ${conversation.externalThreadId}`}
                               </h3>
                               <p className="text-sm text-base-content/60 line-clamp-2" data-testid="conversation-message-preview">
                                 {conversation.latestMessagePreview || 'No messages yet'}
                               </p>
                             </div>
                            <div className="flex flex-col items-start lg:items-end gap-1 text-sm text-base-content/60">
                              <span>{conversation.latestMessageAt ? formatTimestamp(conversation.latestMessageAt) : 'Never'}</span>
                              <span>
                                {conversation.assignedUserName
                                  ? `Assigned to ${conversation.assignedUserName}`
                                  : 'Unassigned'}
                              </span>
                            </div>
                          </div>

                          {conversation.tags && conversation.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2" data-testid="conversation-tags">
                              {conversation.tags.map((tag: ConversationTag) => (
                                <span
                                  key={tag.id}
                                  className="badge badge-sm"
                                  style={{ backgroundColor: tag.color, color: '#fff' }}
                                  data-testid="conversation-tag"
                                  data-tag-id={tag.id}
                                  data-tag-name={tag.name}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2" data-testid="pagination-controls">
                       <div className="text-sm text-base-content/60" data-testid="page-info">
                         Page {page} of {totalPages} · {totalCount} total
                       </div>
                       <div className="flex gap-2">
                        <button
                          className="btn btn-sm"
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={page <= 1 || isFetching}
                        >
                          Previous
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={page >= totalPages || isFetching}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-xl mb-4">Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Name</div>
                    <div className="text-base font-semibold">{user?.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Email</div>
                    <div className="text-base font-semibold">{user?.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Role</div>
                    <div className="badge badge-primary badge-lg capitalize">
                      {user?.role?.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Status</div>
                    <div className="badge badge-success badge-lg capitalize">{user?.status}</div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Member Since</div>
                    <div className="text-base">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-base-content/60 font-medium mb-1">Email Verified</div>
                    <div className="text-base">
                      {user?.emailVerified ? (
                        <span className="badge badge-success badge-sm">Verified</span>
                      ) : (
                        <span className="badge badge-warning badge-sm">Not Verified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
