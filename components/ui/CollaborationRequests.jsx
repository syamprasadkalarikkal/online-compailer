import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Inbox, ChevronRight } from 'lucide-react';

/**
 * Displays pending collaboration requests
 * Handles accepting/declining requests with real-time updates
 */
export const CollaborationRequests = ({ user, supabase, onAcceptRequest }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  /**
   * Set up real-time subscriptions and load initial requests
   */
  useEffect(() => {
    if (user && supabase) {
      loadRequests();
      
      const channel = supabase
        .channel('user_collaboration_requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_requests',
          filter: `recipient_id=eq.${user.id}`
        }, () => {
          loadRequests();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'collaboration_requests',
          filter: `recipient_id=eq.${user.id}`
        }, () => {
          loadRequests();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [user, supabase]);

  /**
   * Close panel when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPanel && 
          panelRef.current && 
          buttonRef.current &&
          !panelRef.current.contains(event.target) && 
          !buttonRef.current.contains(event.target)) {
        setShowPanel(false);
        setExpandedId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel]);

  /**
   * Loads all pending collaboration requests
   */
  const loadRequests = async () => {
    if (!user || !supabase) return;

    try {
      const { data: requestsData, error: requestsError } = await supabase
        .from('collaboration_requests')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) {
        throw requestsError;
      }

      setRequests(requestsData || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles accepting or declining a collaboration request
   */
  const handleRequest = async (request, action) => {
    if (!supabase) return;

    setProcessing(request.id);

    try {
      if (action === 'accepted') {
        // Add user as collaborator
        const { error: collabError } = await supabase
          .from('collaborators')
          .insert([{
            code_id: request.code_id,
            user_id: user.id,
            is_owner: false,
            is_editing: false,
            last_active: new Date().toISOString()
          }]);

        if (collabError && collabError.code !== '23505') {
          throw new Error('Failed to add you as a collaborator: ' + collabError.message);
        }

        // Update request status
        const { error: updateError } = await supabase
          .from('collaboration_requests')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id);

        if (updateError) {
          throw new Error('Failed to update request status: ' + updateError.message);
        }

        if (onAcceptRequest) {
          onAcceptRequest(request);
        }
      } else {
        // Decline request
        const { error: updateError } = await supabase
          .from('collaboration_requests')
          .update({ 
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id);

        if (updateError) {
          throw updateError;
        }
      }

      setRequests(prev => prev.filter(r => r.id !== request.id));
      setExpandedId(null);
    } catch (error) {
      console.error('Error handling request:', error);
    } finally {
      setProcessing(null);
    }
  };

  const getSenderDisplayName = (request) => {
    if (request.sender_name && request.sender_name.trim() !== '') {
      return request.sender_name;
    }
    return request.sender_email || 'Unknown';
  };

  const getSenderInitial = (request) => {
    const displayName = getSenderDisplayName(request);
    return displayName.charAt(0).toUpperCase();
  };

  const isCustomMessage = (request) => {
    if (!request.message || request.message.trim() === '') return false;
    const defaultPattern = /wants to collaborate on/i;
    return !defaultPattern.test(request.message);
  };

  const pendingCount = requests.length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex items-center gap-2 px-3 py-1 bg-white hover:text-gray-600 rounded transition-colors text-black text-sm"
        title="View collaboration requests"
      >
        <Bell className="w-4 h-4" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div 
          ref={panelRef}
          className="absolute right-0 bottom-full mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[28rem] overflow-hidden flex flex-col"
        >
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-gray-900 font-semibold text-sm">Collaboration Requests</h3>
            {pendingCount > 0 && (
              <p className="text-gray-500 text-xs mt-0.5">{pendingCount} pending</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 text-xs mt-2">Loading...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-6 text-center">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No pending requests</p>
                <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div>
                {requests.map((request) => (
                  <div key={request.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className="relative w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden ring-2 ring-gray-200">
                        {request.sender_avatar_url ? (
                          <>
                            <img 
                              src={request.sender_avatar_url} 
                              alt={getSenderDisplayName(request)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = e.target.nextElementSibling;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                            <div 
                              className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
                              style={{ display: 'none' }}
                            >
                              {getSenderInitial(request)}
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            {getSenderInitial(request)}
                          </div>
                        )}
                      </div>
                      
                      {/* Request info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-sm font-medium truncate">
                          {getSenderDisplayName(request)}
                        </p>
                        <p className="text-gray-500 text-xs truncate">
                          Wants to collaborate on{' '}
                          <span className="font-medium text-gray-700">
                            {request.code_title || 'a code'}
                          </span>
                        </p>
                        {request.code_language && (
                          <p className="text-gray-400 text-xs mt-0.5">
                            {request.code_language}
                          </p>
                        )}
                      </div>

                      <ChevronRight 
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                          expandedId === request.id ? 'rotate-90' : ''
                        }`} 
                      />
                    </button>
                    
                    {/* Expanded content */}
                    {expandedId === request.id && (
                      <div className="px-4 pb-3 pt-1 bg-gray-50">
                        {isCustomMessage(request) && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1 font-medium">Message:</p>
                            <p className="text-gray-700 text-xs py-2 px-3 bg-white border border-gray-200 rounded italic">
                              {request.message}
                            </p>
                          </div>
                        )}

                        {request.sender_email && (
                          <p className="text-xs text-gray-500 mb-3">
                            From: {request.sender_email}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRequest(request, 'accepted')}
                            disabled={processing === request.id}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-900 hover:to-gray-900 text-white rounded-lg transition-all text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {processing === request.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Accept
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRequest(request, 'rejected')}
                            disabled={processing === request.id}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};