// components/ProfileSettings.jsx - Corrected to match users table structure
import React, { useState, useRef } from 'react';
import { Camera, Save, X, User, Mail, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export const ProfileSettings = ({
  user,
  profileData,
  setProfileData,
  userRecord,
  setUserRecord,
  storageAvailable,
  setActiveView,
  onUserUpdate
}) => {
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Load profile data on mount
  React.useEffect(() => {
    const loadProfile = async () => {
      if (!user || !supabase) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          // If no record exists yet, that's okay
          if (error.code !== 'PGRST116') {
            console.error('Error loading profile:', error);
          }
          return;
        }

        if (data) {
          setUserRecord(data);
          setProfileData({
            name: data.name || '',
            profilePicture: data.avatar_url || null,
            bio: data.bio || ''
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, [user, supabase, setProfileData, setUserRecord]);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!supabase) {
      setError('Database connection is not available. Please try again.');
      return;
    }

    if (!storageAvailable) {
      setError('Image upload is not available. Storage needs to be configured.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, JPEG, and PNG files are allowed');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Failed to upload image. Please try again.');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const newAvatarUrl = urlData?.publicUrl;

      if (!newAvatarUrl) {
        setError('Failed to get image URL');
        return;
      }

      // Update local state immediately
      setProfileData(prev => ({
        ...prev,
        profilePicture: newAvatarUrl
      }));

      setSuccess('Profile picture uploaded. Click Save to keep changes.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate required data
    if (!profileData?.name?.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // If supabase is not available, just update local state
      if (!supabase) {
        console.warn('No Supabase client - updating locally only');
        
        const updatedProfile = {
          ...profileData,
          name: profileData.name.trim(),
          bio: profileData.bio || ''
        };
        
        setProfileData(updatedProfile);

        if (onUserUpdate) {
          onUserUpdate();
        }

        setSuccess('Profile updated locally. Database connection not available - changes won\'t persist.');
        setTimeout(() => {
          setActiveView('profile');
        }, 2000);
        return;
      }

      // Verify authentication
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !currentUser) {
        throw new Error('Authentication error. Please log in again.');
      }

      // Prepare data for save
      const updatedData = {
        name: profileData.name.trim(),
        avatar_url: profileData.profilePicture,
        bio: profileData.bio || '',
        updated_at: new Date().toISOString()
      };

      let result;

      if (userRecord) {
        // Update existing record
        result = await supabase
          .from('users')
          .update(updatedData)
          .eq('id', userRecord.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (result.error) {
          console.error('Update error:', result.error);
          throw new Error(`Failed to update profile: ${result.error.message}`);
        }

        setUserRecord(result.data);
      } else {
        // Create new record
        const newUserData = {
          user_id: currentUser.id,
          email: currentUser.email,
          ...updatedData
        };

        result = await supabase
          .from('users')
          .insert([newUserData])
          .select()
          .single();

        if (result.error) {
          console.error('Insert error:', result.error);
          
          if (result.error.code === '23505') {
            throw new Error('Profile already exists. Please refresh the page.');
          } else if (result.error.code === '42501') {
            throw new Error('Permission denied. Please check your database policies.');
          } else {
            throw new Error(`Failed to create profile: ${result.error.message}`);
          }
        }

        setUserRecord(result.data);
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        name: result.data.name,
        profilePicture: result.data.avatar_url,
        bio: result.data.bio
      }));

      if (onUserUpdate) {
        onUserUpdate();
      }

      setSuccess('Profile saved successfully!');
      
      setTimeout(() => {
        setActiveView('profile');
      }, 1500);

    } catch (error) {
      console.error('Error saving profile:', error);
      setError(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header with back button */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={() => setActiveView('profile')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h3 className="text-gray-900 font-semibold">Profile Settings</h3>
          <p className="text-gray-600 text-xs">Update your profile information</p>
        </div>
      </div>

      {/* Profile Settings Form */}
      <div className="p-4 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Saving Message */}
        {saving && !error && !success && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">Saving your profile...</p>
          </div>
        )}

        {/* Profile Picture Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {profileData.profilePicture ? (
              <img 
                src={profileData.profilePicture} 
                alt="Profile" 
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center ${profileData.profilePicture ? 'hidden' : 'flex'}`}
            >
              <User className="w-10 h-10 text-white" />
            </div>
            
            {/* Camera overlay - Only show if storage is available */}
            {storageAvailable && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg transition-colors bg-indigo-600 hover:bg-indigo-700"
              >
                {uploadingImage ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            onChange={handleImageUpload}
            className="hidden"
          />

          {!storageAvailable && (
            <p className="text-xs text-yellow-600 text-center">
              Image upload unavailable - storage not configured
            </p>
          )}
        </div>

        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Display Name *
          </label>
          <input
            type="text"
            value={profileData.name || ''}
            onChange={(e) => {
              setProfileData(prev => ({ ...prev, name: e.target.value }));
              setError(null);
              setSuccess(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Enter your name"
            required
          />
        </div>

        {/* Email Field (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email Address
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed here</p>
        </div>

        {/* Bio Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Bio (Optional)
          </label>
          <textarea
            value={profileData.bio || ''}
            onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows="3"
            placeholder="Tell us about yourself..."
            maxLength="500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {(profileData.bio || '').length}/500 characters
          </p>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !profileData.name?.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
          
          <button
            onClick={() => setActiveView('profile')}
            disabled={saving}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Database Status Info */}
        {!supabase && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              Database connection unavailable. Changes will only be saved locally and won't persist between sessions.
            </p>
          </div>
        )}

        {/* Optional Profile Picture Note */}
        <div className="text-xs text-gray-500 text-center">
          Profile picture is optional. You can save your profile without uploading an image.
        </div>
      </div>
    </div>
  );
};