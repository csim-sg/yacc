/**
 * Conversation Detail Page
 * Read-only conversation view
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReplyComposer } from '../components/ReplyComposer';
import { RightPanel } from '../components/RightPanel/RightPanel';
import {
  conversationsService,
  type ConversationDetail,
  type ConversationMessage,
  type ConversationStatus,
  type ConversationPriority,
  type ChannelType,
  type GetConversationResponse,
} from '../services/conversations.service';
import { useAuth } from '../contexts/AuthContext';

const CHANNEL_LABELS: Record<ChannelType, string> = {
  telegram: 'Telegram',
  irc: 'IRC',
  email: 'Email',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  wechat: 'WeChat',
  meta: 'Meta',
  x: 'X (Twitter)',
};

const PRIORITY_BADGE: Record<ConversationPriority, string> = {
  low: 'badge-ghost',
  medium: 'badge-info',
  high: 'badge-warning',
  urgent: 'badge-error',
};

const STATUS_BADGE: Record<ConversationStatus, string> = {
  open: 'badge-success',
  pending: 'badge-warning',
  resolved: 'badge-neutral',
};

export function ConversationPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { id } = useParams();

  const conversationId = useMemo(() => {
    // IDs are UUID strings, not numbers
    return id && id.length > 0 ? id : null;
  }, [id]);

  useEffect(() => {
    const checkScreenSize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fetch conversation metadata
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<GetConversationResponse, { error?: string; message?: string }>({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationsService.getById(conversationId as string),
    enabled: !!conversationId,
  });

   // Fetch messages separately
   const {
     data: messagesData,
     isLoading: messagesLoading,
   } = useQuery({
     queryKey: ['conversationMessages', conversationId],
     queryFn: () => conversationsService.getMessages(conversationId as string),
     enabled: !!conversationId,
   });

    // Send message mutation
    const queryClient = useQueryClient();
    const sendMessageMutation = useMutation({
      mutationFn: (body: string) =>
        conversationsService.sendMessage(conversationId as string, body),
      onSuccess: (response) => {
        // Add message to the messages list cache
        // Response shape: { data: ConversationMessage }
        queryClient.setQueryData(
          ['conversationMessages', conversationId],
          (oldData: unknown) => {
            if (!oldData || typeof oldData !== 'object' || !('data' in oldData)) {
              return { data: [response.data] };
            }
            const typedData = oldData as { data: ConversationMessage[] };
            return {
              ...typedData,
              data: [...typedData.data, response.data],
            };
          }
        );
      },
    });

   const conversation: ConversationDetail | null = data?.data ?? null;
   const messages = messagesData?.data ?? [];
   const errorMessage = error?.error || error?.message || 'Failed to load conversation';

  const handleLogout = async () => {
    await logout();
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const formatTimestamp = (value?: string) => {
    if (!value) {
      return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

   const renderMessageBubble = (message: ConversationMessage) => {
     const isInbound = message.direction === 'inbound';

     return (
       <div
         key={message.id}
         className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
       >
         <div
           className={`max-w-[80%] rounded-lg px-4 py-3 shadow-sm ${
             isInbound ? 'bg-base-100 border border-base-200' : 'bg-primary text-primary-content'
           }`}
         >
           <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
             <span data-testid="message-sender">{message.senderName || (isInbound ? 'Inbound' : 'Agent')}</span>
             <span>•</span>
             <span>{formatTimestamp(message.createdAt)}</span>
             <span className="badge badge-xs badge-outline">
               {message.status}
             </span>
           </div>
           <p className="text-sm whitespace-pre-wrap" data-testid="message-body">{message.body}</p>
         </div>
       </div>
     );
   };

  return (
    <div className="h-screen flex flex-col bg-base-200">
      {/* Fixed Top Navigation */}
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

          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-content text-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-lg sm:text-xl">Y</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold leading-tight truncate">YACC Inbox</h1>
              <p className="text-xs text-primary-content/70 hidden md:block">Omni-channel Social Inbox</p>
            </div>
          </Link>
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
                <a className="text-xs py-2">{user?.email}</a>
              </li>
              <li>
                <a className="text-xs py-2">
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
                  {authLoading ? 'Logging out...' : 'Logout'}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Layout with Sidebar */}
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
                <Link to="/" className="justify-between">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                    </svg>
                    Inbox
                  </div>
                </Link>
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
                <button className="justify-start" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                  All Channels
                </button>
              </li>
              <li>
                <button className="justify-start" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
                  </svg>
                  Telegram
                </button>
              </li>
              <li>
                <button className="justify-start" disabled>
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.220.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Preferences
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <main
          className={`flex-1 overflow-hidden transition-all duration-300 
            ${sidebarOpen ? 'ml-[280px]' : 'ml-0 lg:ml-[280px]'}`}
        >
          {/* Conversation view with right panel */}
          <div className="h-full flex flex-col lg:flex-row">
            {/* Main conversation area */}
            <div className="flex-1 overflow-y-auto">
              <div className="container mx-auto p-4 md:p-6 max-w-4xl">
                <div className="card bg-base-100 shadow-xl mb-6">
                  <div className="card-body">
                    <div className="flex flex-col gap-4">
                       <div className="flex items-center gap-3" data-testid="conversation-header">
                          <Link to="/" className="btn btn-ghost btn-sm" data-testid="back-button">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                            Back
                          </Link>
                          <div className="flex items-center gap-2">
                            <h2 className="card-title text-2xl">Conversation</h2>
                           {isFetching && !isLoading && (
                             <span className="loading loading-spinner loading-sm text-primary"></span>
                           )}
                         </div>
                       </div>

                       {isLoading && (
                         <div className="space-y-4">
                           <div className="skeleton h-6 w-1/3"></div>
                           <div className="skeleton h-4 w-1/2"></div>
                           <div className="skeleton h-4 w-2/3"></div>
                         </div>
                       )}

                        {!isLoading && error && (
                          <div className="alert alert-error" data-testid="error-message">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <h3 className="font-semibold">Failed to load conversation</h3>
                              <div className="text-sm opacity-80">{errorMessage}</div>
                            </div>
                            <button className="btn btn-sm" onClick={() => refetch()} data-testid="retry-button">
                              Retry
                            </button>
                          </div>
                        )}

                        {!isLoading && !error && !conversation && (
                          <div className="text-center text-base-content/70" data-testid="conversation-detail">Conversation not found.</div>
                        )}

                        {!isLoading && !error && conversation && (
                          <div className="flex flex-col gap-6" data-testid="conversation-detail">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge badge-outline badge-sm" data-testid="conversation-channel">
                                {CHANNEL_LABELS[conversation.channel] || conversation.channel}
                              </span>
                              <span className={`badge badge-sm ${STATUS_BADGE[conversation.status]}`} data-testid="conversation-status">
                                {conversation.status}
                              </span>
                              <span className={`badge badge-sm ${PRIORITY_BADGE[conversation.priority]}`} data-testid="conversation-priority">
                                {conversation.priority}
                              </span>
                             {conversation.assignedUserId && (
                               <span className="badge badge-sm badge-ghost">
                                 Assigned to #{conversation.assignedUserId}
                               </span>
                             )}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                             <div>
                               <div className="text-base-content/60">Thread</div>
                               <div className="font-semibold">{conversation.title || conversation.externalThreadId}</div>
                             </div>
                             <div>
                               <div className="text-base-content/60">Created</div>
                               <div className="font-semibold">{formatTimestamp(conversation.createdAt)}</div>
                             </div>
                           </div>

                           <div className="divider"></div>

                            <div className="space-y-4" data-testid="conversation-messages">
                              <h3 className="text-lg font-semibold">Messages</h3>
                              {messagesLoading && (
                                <div className="loading loading-spinner loading-md"></div>
                              )}
                              {!messagesLoading && messages.length === 0 && (
                                <div className="text-base-content/60">No messages yet.</div>
                              )}
                              {!messagesLoading && messages.length > 0 && (
                                <div className="flex flex-col gap-3">
                                  {messages.map((msg) => (
                                    <div key={msg.id} data-testid="message-item">
                                      {renderMessageBubble(msg)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="divider"></div>

                            {/* Reply Composer */}
                            <div>
                              <h3 className="text-lg font-semibold mb-4">Reply</h3>
                              <ReplyComposer
                                onSend={async (body) => {
                                  await sendMessageMutation.mutateAsync(body);
                                }}
                                isSending={sendMessageMutation.isPending}
                                error={
                                  sendMessageMutation.error instanceof Error
                                    ? sendMessageMutation.error.message
                                    : sendMessageMutation.error
                                      ? String(sendMessageMutation.error)
                                      : undefined
                                }
                                showError={true}
                                onErrorDismiss={() => sendMessageMutation.reset()}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            {/* Right Panel - Hidden on mobile, visible on lg screens */}
            {!isLoading && !error && conversation && (
              <div className="hidden lg:flex">
                <RightPanel
                  conversation={conversation}
                  onAssignmentChange={() => {
                    // Refetch conversation to get updated assignment
                    void queryClient.invalidateQueries({
                      queryKey: ['conversation', conversation.id],
                    });
                  }}
                  onTagsChange={() => {
                    // Refetch conversation to get updated tags
                    void queryClient.invalidateQueries({
                      queryKey: ['conversation', conversation.id],
                    });
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
