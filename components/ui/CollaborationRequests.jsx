// components/CollaborationRequests.jsx - FIXED VERSION WITH PROPER ERROR HANDLING
import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Mail } from 'lucide-react';

export const CollaborationRequests = ({ user, supabase, onAcceptRequest }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (user && supabase) {
      loadRequests();
      
      // Subscribe to new requests in real-time
      const channel = supabase
        .channel('user_collaboration_requests')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_requests',
          filter: `recipient_id=eq.${user.id}`
        }, (payload) => {
          console.log('🔔 New collaboration request received:', payload);
          loadRequests();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'collaboration_requests',
          filter: `recipient_id=eq.${user.id}`
        }, (payload) => {
          console.log('📝 Collaboration request updated:', payload);
          loadRequests();
        })
        .subscribe((status) => {
          console.log('Collaboration requests subscription status:', status);
        });

      return () => {
        console.log('Unsubscribing from collaboration requests');
        channel.unsubscribe();
      };
    }
  }, [user, supabase]);

  const loadRequests = async () => {
    if (!user || !supabase) return;

    console.log('📥 Loading collaboration requests for user:', user.id);

    try {
      // Get requests with code info
      const { data: requestsData, error: requestsError } = await supabase
        .from('collaboration_requests')
        .select(`
          *,
          code:saved_codes!code_id(id, title, language)
        `)
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error loading requests:', requestsError);
        throw requestsError;
      }

      console.log('✅ Loaded requests:', requestsData);
      setRequests(requestsData || []);
    } catch (error) {
      console.error('❌ Error loading requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (request, action) => {
    if (!supabase) return;

    setProcessing(request.id);

    try {
      console.log(`${action === 'accepted' ? '✅' : '❌'} Processing request:`, request.id);

      if (action === 'accepted') {
        // IMPORTANT: Add to collaborators table FIRST before updating request status
        console.log('➕ Adding user as collaborator...');

        const { error: collabError } = await supabase
          .from('collaborators')
          .insert([{
            code_id: request.code_id,
            user_id: user.id,
            is_owner: false,
            is_editing: false,
            last_active: new Date().toISOString()
          }]);

        if (collabError) {
          // Check if it's a duplicate key error
          if (collabError.code !== '23505') {
            console.error('Error adding collaborator:', collabError);
            throw new Error('Failed to add you as a collaborator: ' + collabError.message);
          } else {
            console.log('ℹ️ User already a collaborator (duplicate key - ignoring)');
          }
        } else {
          console.log('✅ Added as collaborator successfully');
        }

        // Now update request status
        const { error: updateError } = await supabase
          .from('collaboration_requests')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id);

        if (updateError) {
          console.error('Error updating request status:', updateError);
          throw new Error('Failed to update request status: ' + updateError.message);
        }

        console.log('✅ Request accepted and status updated');

        // Notify parent component to load the code
        if (onAcceptRequest) {
          onAcceptRequest(request);
        }

        alert(`✅ Accepted! You can now collaborate on "${request.code?.title || 'this code'}"`);
        
      } else {
        // Decline - just update status
        const { error: updateError } = await supabase
          .from('collaboration_requests')
          .update({ 
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', request.id);

        if (updateError) {
          console.error('Error updating request:', updateError);
          throw updateError;
        }

        console.log('❌ Request declined');
        alert('Request declined.');
      }

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error('❌ Error processing request:', error);
      alert(error.message || 'Failed to process request. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = requests.length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex items-center gap-2 px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded transition-colors text-gray-300 hover:text-white text-sm"
        title="View collaboration requests"
      >
        <Bell className="w-4 h-4" />
        <span className="hidden sm:inline">Requests</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 bottom-full mb-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[32rem] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
              <h3 className="text-gray-900 font-semibold text-lg">Collaboration Requests</h3>
              <p className="text-gray-600 text-xs mt-1">
                {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
              </p>
            </div>

            {/* Requests List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-gray-500 text-sm mt-3">Loading requests...</p>
                </div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center">
                  <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No pending requests</p>
                  <p className="text-gray-400 text-xs mt-1">
                    You'll be notified when someone invites you to collaborate
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {requests.map((request) => (
                    <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {request.sender?.email?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Collaboration Request
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(request.created_at).toLocaleDateString()} at{' '}
                                {new Date(request.created_at).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs text-gray-600">
                              Someone wants you to collaborate on{' '}
                              <span className="font-semibold text-gray-800">
                                "{request.code?.title || 'Untitled'}"
                              </span>
                            </p>
                            {request.code?.language && (
                              <p className="text-xs text-gray-500 mt-1">
                                Language: <span className="font-medium">{request.code.language}</span>
                              </p>
                            )}
                          </div>

                          {request.message && (
                            <p className="text-xs text-gray-600 mt-2 italic bg-gray-50 p-2 rounded border border-gray-100">
                              💬 "{request.message}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleRequest(request, 'accepted')}
                          disabled={processing === request.id}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing === request.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Accept
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRequest(request, 'rejected')}
                          disabled={processing === request.id}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowPanel(false)}
                className="w-full text-sm text-gray-600 hover:text-gray-800 py-1"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};