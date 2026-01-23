// components/CollaborationChat.jsx - COMPLETE REAL-TIME CHAT COMPONENT
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Minimize2, Maximize2 } from 'lucide-react';

export const CollaborationChat = ({ currentCodeId, user, supabase, collaborators }) => {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const wsRef = useRef(null);

  // Load user profiles for avatar display
  useEffect(() => {
    const loadProfiles = async () => {
      if (!supabase || !collaborators || collaborators.length === 0) return;

      try {
        const userIds = collaborators.map(c => c.user_id).filter(Boolean);
        if (userIds.length === 0) return;

        const { data, error } = await supabase
          .from('users')
          .select('user_id, name, avatar_url, email')
          .in('user_id', userIds);

        if (!error && data) {
          const profilesMap = {};
          data.forEach(profile => {
            profilesMap[profile.user_id] = profile;
          });
          setUserProfiles(profilesMap);
        }
      } catch (error) {
        console.error('Error loading profiles:', error);
      }
    };

    loadProfiles();
  }, [collaborators, supabase]);

  // WebSocket logic
  useEffect(() => {
    if (!currentCodeId || !user) return;

    // Connect to WebSocket server
    const ws = new WebSocket('ws://localhost:8081'); // Use env var in production
    wsRef.current = ws;

    ws.onopen = () => {
      // Join the room
      ws.send(JSON.stringify({
        type: 'join',
        userId: user.id,
        codeId: currentCodeId,
        userEmail: user.email
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message') {
          // Add message to state - check if it already exists to avoid duplicates
          setMessages(prev => {
            // Check if message already exists (by timestamp and user_id)
            const exists = prev.some(msg =>
              msg.created_at === data.created_at &&
              msg.user_id === data.user_id &&
              msg.message === data.message
            );

            if (exists) return prev;
            return [...prev, data];
          });

          // Increment unread if chat is closed or minimized and message is not from current user
          if ((!showChat || isMinimized) && data.user_id !== user.id) {
            setUnreadCount(prev => prev + 1);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [currentCodeId, user, showChat, isMinimized]);

  // Load initial messages from Supabase (history)
  useEffect(() => {
    if (!currentCodeId || !supabase) return;
    loadMessages();
  }, [currentCodeId, supabase]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (showChat && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat, isMinimized]);

  // Clear unread count when opening chat
  useEffect(() => {
    if (showChat && !isMinimized) {
      setUnreadCount(0);
    }
  }, [showChat, isMinimized]);

  // Close chat and reset when currentCodeId becomes null (New button clicked)
  useEffect(() => {
    if (!currentCodeId) {
      setShowChat(false);
      setMessages([]);
      setUnreadCount(0);
      setIsMinimized(false);
    }
  }, [currentCodeId]);

  // Click outside to close chat
  useEffect(() => {
    if (!showChat) return;

    const handleClickOutside = (event) => {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        setShowChat(false);
      }
    };

    // Add a small delay to prevent immediate closing when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChat]);

  const loadMessages = async () => {
    if (!currentCodeId || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('code_id', currentCodeId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentCodeId || !user || !supabase || sending) return;

    setSending(true);
    const timestamp = new Date().toISOString();
    const messageText = newMessage.trim();

    try {
      const messageData = {
        code_id: currentCodeId,
        user_id: user.id,
        message: messageText,
        created_at: timestamp
      };

      // Optimistically add message to local state immediately
      setMessages(prev => [...prev, messageData]);
      setNewMessage('');

      // Send via WebSocket for real-time updates to other users
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat_message',
          codeId: currentCodeId,
          userId: user.id,
          user_id: user.id,
          message: messageText,
          created_at: timestamp,
          timestamp: timestamp
        }));
      }

      // Persist to Supabase
      const { error } = await supabase
        .from('chat_messages')
        .insert([messageData]);

      if (error) {
        // Remove the optimistic message on error
        setMessages(prev => prev.filter(msg => msg.created_at !== timestamp));
        throw error;
      }

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageText); // Restore the message
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getUserProfile = (userId) => {
    return userProfiles[userId] || { name: 'Unknown', avatar_url: null };
  };

  const getInitials = (userId) => {
    const profile = getUserProfile(userId);
    const name = profile.name || profile.email || '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  // Only show if there are multiple collaborators
  if (!collaborators || collaborators.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={chatRef}>
      {/* Chat Toggle Button */}
      <button
        onClick={() => {
          setShowChat(!showChat);
          if (!showChat) {
            setIsMinimized(false);
          }
        }}
        className="relative flex items-center gap-2 px-3 py-1 bg-white hover:text-gray-600 rounded transition-colors text-black text-sm"
        title="Open collaboration chat"
      >
        <MessageSquare className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute right-0 bottom-full mb-2 w-96 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-600">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <h3 className="text-white font-semibold text-sm">Team Chat</h3>
              <span className="text-white/70 text-xs">
                {collaborators.length} member{collaborators.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4 text-white" />
                ) : (
                  <Minimize2 className="w-4 h-4 text-white" />
                )}
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 hover:bg-white/20 rounded transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 max-h-96 min-h-[16rem]">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No messages yet</p>
                    <p className="text-gray-400 text-xs mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwnMessage = msg.user_id === user?.id;
                    const profile = getUserProfile(msg.user_id);
                    const showAvatar = index === 0 || messages[index - 1].user_id !== msg.user_id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        {showAvatar ? (
                          <div className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-white overflow-hidden">
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-full h-full ${profile.avatar_url ? 'hidden' : 'flex'} items-center justify-center text-xs font-bold ${isOwnMessage
                                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                                : 'bg-gradient-to-br from-indigo-400 to-purple-600'
                                } text-white`}
                            >
                              {getInitials(msg.user_id)}
                            </div>
                          </div>
                        ) : (
                          <div className="w-8" />
                        )}

                        {/* Message Bubble */}
                        <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                          {showAvatar && (
                            <span className="text-xs text-gray-600 font-medium mb-1 px-1">
                              {isOwnMessage ? 'You' : profile.name || profile.email}
                            </span>
                          )}
                          <div
                            className={`px-3 py-2 rounded-lg ${isOwnMessage
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                              }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          </div>
                          <span className="text-xs text-gray-400 mt-1 px-1">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    disabled={sending}
                    rows={1}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    style={{ maxHeight: '80px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 px-1">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};