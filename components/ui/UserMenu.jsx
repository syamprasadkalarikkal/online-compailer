// components/UserMenu.jsx
import React, { useRef, useEffect, useState } from 'react';
import { User, Code, Settings, LogOut } from 'lucide-react';
import { SavedCodes } from './SavedCodes';
import { ProfileSettings } from './ProfileSettings';

/**
 * User menu component with profile management and saved codes
 * Displays user information, saved codes list, and profile settings
 */
export const UserMenu = ({
  showUserMenu,
  setShowUserMenu,
  user,
  savedCodes,
  loadCode,
  editingCodeName,
  setEditingCodeName,
  renameCode,
  deleteCode,
  fileExtensions,
  handleLogout,
  supabase,
  onUserUpdate
}) => {
  const menuRef = useRef(null);
  const [activeView, setActiveView] = useState('profile');
  const [profileData, setProfileData] = useState({
    name: user?.email?.split('@')[0] || '',
    profilePicture: user?.user_metadata?.avatar_url || null,
    profilePictureFile: null,
    bio: ''
  });
  const [userRecord, setUserRecord] = useState(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load user profile on mount and when user changes
   */
  useEffect(() => {
    if (user && supabase) {
      loadUserProfile();
      checkStorageAvailability();
    }
  }, [user?.id]);

  /**
   * Reload profile when menu opens to ensure fresh data
   */
  useEffect(() => {
    if (showUserMenu && user && supabase) {
      loadUserProfile();
    }
    if (!showUserMenu) {
      setActiveView('profile');
    }
  }, [showUserMenu, user?.id, supabase]);

  /**
   * Close menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
        setActiveView('profile');
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu, setShowUserMenu]);

  /**
   * Checks if Supabase storage is available for profile pictures
   */
  const checkStorageAvailability = async () => {
    if (!supabase) {
      setStorageAvailable(false);
      return;
    }

    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        setStorageAvailable(false);
        return;
      }
      
      const profileBucket = data.find(bucket => bucket.name === 'profile-pictures');
      setStorageAvailable(!!profileBucket);
    } catch (error) {
      setStorageAvailable(false);
    }
  };

  /**
   * Loads user profile data from database
   * Falls back to auth metadata if database record doesn't exist
   */
  const loadUserProfile = async () => {
    if (!supabase || !user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      setDbError(null);
      
      // Set fallback data immediately to avoid blank state
      const fallbackData = {
        name: user.email?.split('@')[0] || user.user_metadata?.full_name || '',
        profilePicture: user.user_metadata?.avatar_url || null,
        profilePictureFile: null,
        bio: ''
      };
      
      setProfileData(fallbackData);
      
      // Fetch from database
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, user_id, name, avatar_url, bio, email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading profile:', fetchError.message);
        setDbError('Database connection issue. Some features may be limited.');
        setIsLoading(false);
        return;
      }

      if (existingUser) {
        setUserRecord(existingUser);
        
        const newProfileData = {
          name: existingUser.name || fallbackData.name,
          profilePicture: existingUser.avatar_url || null,
          profilePictureFile: null,
          bio: existingUser.bio || ''
        };
        
        setProfileData(newProfileData);
      } else {
        setUserRecord(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setDbError('Database connection issue. Some features may be limited.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Callback after profile update to reload data
   */
  const handleProfileUpdate = async () => {
    await loadUserProfile();
    
    if (onUserUpdate) {
      onUserUpdate();
    }
  };

  if (!showUserMenu) return null;

  /**
   * Renders the main profile view with user info and menu options
   */
  const renderProfileView = () => (
    <div className="p-4">
      {/* Database error warning */}
      {dbError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-xs">{dbError}</p>
        </div>
      )}

      {/* User info section */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          {profileData?.profilePicture ? (
            <img 
              key={profileData.profilePicture}
              src={profileData.profilePicture} 
              alt="Profile" 
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center ${profileData?.profilePicture ? 'hidden' : 'flex'}`}
          >
            <User className="w-8 h-8 text-white" />
          </div>
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 font-semibold text-lg truncate">
            {profileData?.name || user?.email?.split('@')[0] || 'User'}
          </p>
          <p className="text-gray-600 text-sm truncate">{user?.email}</p>
          <p className="text-gray-500 text-xs mt-1">
            {savedCodes?.length || 0} saved {savedCodes?.length === 1 ? 'code' : 'codes'}
          </p>
        </div>
      </div>

      {/* Storage warning if not available */}
      {!storageAvailable && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-xs">
            Note: Image upload is currently unavailable. Storage may need to be configured.
          </p>
        </div>
      )}

      {/* Menu options */}
      <div className="space-y-2">
        <button
          onClick={() => setActiveView('savedCodes')}
          className="w-full flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Code className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">Saved Codes</span>
            <p className="text-xs text-gray-500">View and manage your code snippets</p>
          </div>
          <span className="text-xs bg-gray-200 px-2 py-1 rounded-full font-medium">
            {savedCodes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('profileSettings')}
          className="w-full flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
        >
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <Settings className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">Profile Settings</span>
            <p className="text-xs text-gray-500">Update your profile information</p>
          </div>
        </button>
      </div>
    </div>
  );

  /**
   * Returns content based on active view
   */
  const getViewContent = () => {
    switch (activeView) {
      case 'profile':
        return renderProfileView();
      case 'savedCodes':
        return (
          <SavedCodes
            savedCodes={savedCodes}
            loadCode={loadCode}
            editingCodeName={editingCodeName}
            setEditingCodeName={setEditingCodeName}
            renameCode={renameCode}
            deleteCode={deleteCode}
            fileExtensions={fileExtensions}
            setShowUserMenu={setShowUserMenu}
            setActiveView={setActiveView}
          />
        );
      case 'profileSettings':
        return (
          <ProfileSettings
            user={user}
            profileData={profileData}
            setProfileData={setProfileData}
            userRecord={userRecord}
            setUserRecord={setUserRecord}
            storageAvailable={storageAvailable}
            setActiveView={setActiveView}
            supabase={supabase}
            onUserUpdate={handleProfileUpdate}
          />
        );
      default:
        return renderProfileView();
    }
  };

  return (
    <div 
      ref={menuRef}
      className="absolute right-0 bottom-full mb-2 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {getViewContent()}
      
      {/* Logout button - always visible */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            handleLogout();
            setShowUserMenu(false);
            setActiveView('profile');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </div>
  );
};