import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Heart, Sparkles, Users, LogOut, Loader2 } from 'lucide-react';
import WysiwygEditor from '@/components/wysiwyg-editor';
import { apiClient } from '@/lib/apiClient';

const sampleWishlistTemplate = `# My Dream Wishlist

## What I Want

### Personal Dreams
- [ ] Learn to play the guitar and perform at a local venue
- [ ] Travel to Japan and experience authentic culture
- [ ] Write and publish a novel
- [ ] Learn a new language fluently

### Professional Goals
- [ ] Start my own sustainable business
- [ ] Mentor someone in my field
- [ ] Speak at a major conference
- [ ] Contribute to open source projects

### Life Experiences
- [ ] Volunteer for a meaningful cause
- [ ] Learn to cook authentic Italian cuisine
- [ ] Take a solo backpacking trip
- [ ] Build lasting friendships with people from different cultures

## What I Can Do

### Skills & Talents
- **Technical Skills**: Web development, data analysis, problem-solving
- **Creative Abilities**: Writing, photography, graphic design
- **Languages**: English (native), Spanish (conversational)
- **Tools**: Various programming languages, design software

### What I Can Offer
- **Mentoring**: I can help beginners learn web development
- **Collaboration**: Open to creative projects and partnerships
- **Teaching**: Can share knowledge about technology and design
- **Support**: Available to listen and provide emotional support

### Resources I Can Share
- **Time**: Weekends and evenings for meaningful projects
- **Space**: Can host small gatherings or workshops
- **Equipment**: Have access to cameras, computers, and other tools
- **Network**: Connections in tech and creative communities

---

*This wishlist is a living document. Feel free to edit, add, or remove anything to make it truly yours!*`;

export default function WishlistEditor() {
  const { user, logout } = useAuth();
  const [wishlistContent, setWishlistContent] = useState(sampleWishlistTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [existingWishlist, setExistingWishlist] = useState<any>(null);

  // Load existing wishlist on component mount
  useEffect(() => {
    const loadExistingWishlist = async () => {
      try {
        const response = await apiClient.get("/api/wishlists");
        if (response.data && response.data.length > 0) {
          // Use the most recent wishlist
          const latestWishlist = response.data[0];
          setExistingWishlist(latestWishlist);
          setWishlistContent(latestWishlist.content);
          console.log("Loaded existing wishlist:", latestWishlist);
        }
      } catch (error) {
        console.error("Error loading existing wishlist:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingWishlist();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let response;
      if (existingWishlist) {
        // Update existing wishlist
        response = await apiClient.put(`/api/wishlists/${existingWishlist.id}`, {
          title: "My Dream Wishlist",
          content: wishlistContent,
          isPublic: true
        });
        console.log("Wishlist updated successfully:", response.data);
      } else {
        // Create new wishlist
        response = await apiClient.post("/api/wishlists", {
          title: "My Dream Wishlist",
          content: wishlistContent,
          isPublic: true
        });
        setExistingWishlist(response.data);
        console.log("Wishlist created successfully:", response.data);
      }
      
      alert(existingWishlist ? 'Wishlist updated successfully!' : 'Wishlist saved successfully!');
    } catch (error: any) {
      console.error("Error saving wishlist:", error);
      alert('Failed to save wishlist. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
          <p className="text-gray-300">Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center text-white mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="w-8 h-8 text-pink-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              DreamSync
            </h1>
            <Sparkles className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-lg text-gray-300">
            Welcome back, <span className="font-semibold text-white">{user?.ename}</span>!
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {existingWishlist ? 'Edit your wishlist' : 'Create and share your dreams, goals, and what you can offer to the world'}
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                My Wishlist
              </CardTitle>
              <p className="text-gray-600 text-sm">
                Express your dreams, goals, and what you can offer others. Be creative and authentic!
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* WYSIWYG Editor */}
              <WysiwygEditor
                content={wishlistContent}
                onChange={setWishlistContent}
                placeholder="Start writing your wishlist here..."
                className="min-h-[600px]"
              />

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-2 rounded-full shadow-lg transition-all duration-200"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : (existingWishlist ? 'Update Wishlist' : 'Save Wishlist')}
                </Button>
              </div>

              {/* Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Tips for a Great Wishlist
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Be specific about what you want and what you can offer</li>
                  <li>• Include both short-term and long-term goals</li>
                  <li>• Don't be afraid to dream big!</li>
                  <li>• Update your wishlist regularly as you grow and change</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logout Button */}
        <div className="flex justify-center mt-8">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}