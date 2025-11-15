// components/CollaborationButton.jsx - FIXED VERSION
import React, { useState } from 'react';
import { Users, Send, X, AlertCircle } from 'lucide-react';

export const CollaborationButton = ({
  currentCodeId,
  codeTitle,
  user,
  supabase
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const sendCollaborationRequest = async () => {
    const email = recipientEmail.trim().toLowerCase();

    if (!email) {
      setError('Please enter a valid email.');
      return;
    }

    if (!currentCodeId) {
      setError('Code must be saved before inviting collaborators.');
      return;
    }

    if (email === user.email.toLowerCase()) {
      setError('You cannot invite yourself.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      console.log('🔍 Looking up user by email:', email);
      
      // Use the database function to find user
      const { data: recipientUserId, error: lookupError } = await supabase
        .rpc('get_user_id_by_email', { email_to_check: email });

      if (lookupError) {
        console.error('Error looking up user:', lookupError);
        throw new Error('Failed to look up user: ' + lookupError.message);
      }

      if (!recipientUserId) {
        setError('⚠️ No account exists with that email. They need to sign up first.');
        setSending(false);
        return;
      }

      console.log('✅ Found user:', recipientUserId);

      // Check for existing requests
      const { data: existingRequest, error: existingError } = await supabase
        .from('collaboration_requests')
        .select('id, status')
        .eq('code_id', currentCodeId)
        .eq('sender_id', user.id)
        .eq('recipient_id', recipientUserId)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (existingError) {
        console.error('Error checking existing requests:', existingError);
        throw new Error('Failed to check existing requests: ' + existingError.message);
      }

      if (existingRequest) {
        setError(
          existingRequest.status === 'pending'
            ? 'A request is already pending for this user.'
            : 'This user is already collaborating on this code.'
        );
        setSending(false);
        return;
      }

      console.log('📤 Creating collaboration request...');

      // Create the request (NOW WITH sender_email)
      const requestData = {
        code_id: currentCodeId,
        sender_id: user.id,
        sender_email: user.email, // Include sender email for display
        recipient_id: recipientUserId,
        message: message.trim() || `${user.email} wants to collaborate on "${codeTitle}"`,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('collaboration_requests')
        .insert([requestData])
        .select();

      if (insertError) {
        console.error('Error inserting request:', insertError);
        throw new Error('Failed to send request: ' + insertError.message);
      }

      console.log('✅ Request sent successfully!', insertedData);

      // Success!
      setSuccess(true);
      setRecipientEmail('');
      setMessage('');

      setTimeout(() => {
        setSuccess(false);
        setShowDialog(false);
      }, 2000);

    } catch (error) {
      console.error('❌ Collaboration request error:', error);
      setError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      {/* Button */}
      <button
        onClick={() => setShowDialog(true)}
        disabled={!currentCodeId}
        className={`flex items-center gap-2 px-3 py-1 rounded transition-colors text-sm ${
          currentCodeId
            ? 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white'
            : 'bg-gray-700/30 text-gray-500 cursor-not-allowed'
        }`}
        title={currentCodeId ? "Invite collaborator" : "Save code first to collaborate"}
      >
        <Users className="w-4 h-4" />
        <span className="hidden sm:inline">Collaborate</span>
      </button>

      {showDialog && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setShowDialog(false)}
          />

          {/* Dialog */}
          <div className="absolute right-0 bottom-full mb-2 w-96 bg-white rounded-xl shadow-2xl z-50">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Send Collaboration Request</h3>
                <p className="text-xs text-gray-500">
                  Invite someone to edit "{codeTitle || 'Untitled'}"
                </p>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs text-gray-600 flex gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>The recipient must already have a registered account.</span>
              </div>

              {error && (
                <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded">
                  ✅ Request sent successfully!
                </div>
              )}

              {/* Email */}
              <div>
                <label className="text-sm font-medium block mb-1">Collaborator Email *</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={sending}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="someone@example.com"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium block mb-1">Message (Optional)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  disabled={sending}
                  maxLength={200}
                  className="w-full px-3 py-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Add a personal message..."
                />
                <p className="text-xs text-gray-500 mt-1">{message.length}/200</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t">
              <button
                className="flex-1 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
                onClick={() => setShowDialog(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                onClick={sendCollaborationRequest}
                disabled={sending || !recipientEmail.trim()}
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};