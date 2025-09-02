import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { App, Review } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Star, ExternalLink, Share, ArrowLeft, Store } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AppDetailPage() {
  const [, params] = useRoute("/app/:id");
  const appId = params?.id;
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    username: "",
    rating: 5,
    comment: "",
  });
  const { toast } = useToast();

  const { data: app, isLoading: isLoadingApp } = useQuery<App>({
    queryKey: ["/api/apps", appId],
    enabled: !!appId,
  });

  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery<Review[]>({
    queryKey: ["/api/apps", appId, "reviews"],
    enabled: !!appId,
  });

  const reviewMutation = useMutation({
    mutationFn: async (reviewData: typeof reviewForm) => {
      const res = await apiRequest("POST", `/api/apps/${appId}/reviews`, reviewData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/apps", appId, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/apps", appId] });
      setShowReviewForm(false);
      setReviewForm({ username: "", rating: 5, comment: "" });
      toast({
        title: "Review submitted!",
        description: "Thank you for your feedback.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to submit review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renderStars = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating 
                ? "fill-yellow-400 text-yellow-400" 
                : "text-slate-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={() => interactive && onRate?.(star)}
          />
        ))}
      </div>
    );
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter your username.",
        variant: "destructive",
      });
      return;
    }
    reviewMutation.mutate(reviewForm);
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      distribution[review.rating as keyof typeof distribution]++;
    });
    const total = reviews.length || 1;
    return Object.entries(distribution).reverse().map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: (count / total) * 100,
    }));
  };

  if (isLoadingApp) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded-full w-48 mb-8"></div>
            <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
              <div className="flex items-start space-x-6 mb-6">
                <div className="w-20 h-20 bg-gray-200 rounded-2xl"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-8 bg-gray-200 rounded w-64"></div>
                  <div className="h-5 bg-gray-200 rounded w-full"></div>
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Store className="w-20 h-20 text-gray-300 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-black mb-4">App not found</h2>
          <p className="text-gray-600 font-medium mb-6">The app you're looking for doesn't exist.</p>
          <Link href="/">
            <Button className="text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform duration-200" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
              Back to marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link href="/">
          <Button className="mb-8 text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to marketplace
          </Button>
        </Link>

        {/* App header */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
          <div className="flex items-start space-x-6 mb-6">
            {app.logoUrl ? (
              <img 
                src={app.logoUrl} 
                alt={`${app.name} logo`} 
                className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                <Store className="w-12 h-12 text-black" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-black text-black mb-3">{app.name}</h1>
              <p className="text-gray-700 text-lg font-medium mb-4">{app.description}</p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {renderStars(parseFloat(app.averageRating || "0"))}
                  <span className="text-lg font-bold text-black">
                    {parseFloat(app.averageRating || "0").toFixed(1)}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    ({app.totalReviews} reviews)
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide px-3 py-1 bg-gray-100 rounded-full">
                  {app.category}
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <a href={app.link} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button className="w-full text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                <ExternalLink className="w-5 h-5 mr-3" />
                Visit Website
              </Button>
            </a>
            <Button className="text-black font-bold px-6 py-4 rounded-full border-2 border-gray-200 bg-white hover:border-black hover:scale-105 transition-all duration-200">
              <Share className="w-5 h-5 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Screenshots */}
        {app.screenshots && app.screenshots.length > 0 && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
            <h3 className="text-2xl font-black text-black mb-6">Screenshots</h3>
            <div className="flex space-x-6 overflow-x-auto pb-2">
              {app.screenshots.map((screenshot, index) => (
                <img
                  key={index}
                  src={screenshot}
                  alt={`${app.name} screenshot ${index + 1}`}
                  className="w-64 h-44 object-cover rounded-2xl flex-shrink-0 hover:scale-105 transition-transform duration-200 cursor-pointer"
                />
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {app.fullDescription && (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 mb-8">
            <h3 className="text-2xl font-black text-black mb-6">About this app</h3>
            <div className="prose-lg max-w-none">
              {app.fullDescription.split('\n').map((paragraph, index) => (
                <p key={index} className="text-gray-700 font-medium mb-4 last:mb-0 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-black text-black">Reviews & Ratings</h3>
            <Button 
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black"
            >
              {showReviewForm ? "Cancel" : "Write Review"}
            </Button>
          </div>

          {/* Rating Summary */}
          <div className="bg-gray-50 rounded-2xl p-8 mb-8">
            <div className="flex items-center space-x-12">
              <div className="text-center">
                <div className="text-5xl font-black text-black mb-2">
                  {parseFloat(app.averageRating || "0").toFixed(1)}
                </div>
                <div className="flex justify-center mb-3">
                  {renderStars(parseFloat(app.averageRating || "0"))}
                </div>
                <div className="text-sm font-medium text-gray-500">{app.totalReviews} reviews</div>
              </div>
              <div className="flex-1">
                <div className="space-y-3">
                  {getRatingDistribution().map(({ rating, count, percentage }) => (
                    <div key={rating} className="flex items-center space-x-4">
                      <span className="text-sm font-bold text-black w-8">{rating}</span>
                      <Progress value={percentage} className="flex-1 h-3" />
                      <span className="text-sm font-medium text-gray-600 w-12">{Math.round(percentage)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-gray-50 rounded-2xl p-6 mb-8">
              <form onSubmit={handleReviewSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="username" className="text-sm font-bold text-black mb-2 block">Username</Label>
                  <Input
                    id="username"
                    value={reviewForm.username}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    className="h-12 rounded-full border-2 border-gray-200 focus:border-black font-medium"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold text-black mb-2 block">Rating</Label>
                  <div className="flex items-center space-x-3">
                    {renderStars(reviewForm.rating, true, (rating) => 
                      setReviewForm(prev => ({ ...prev, rating }))
                    )}
                    <span className="text-sm font-medium text-gray-600">({reviewForm.rating} stars)</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="comment" className="text-sm font-bold text-black mb-2 block">Comment (optional)</Label>
                  <Textarea
                    id="comment"
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Share your experience with this app..."
                    className="rounded-2xl border-2 border-gray-200 focus:border-black font-medium resize-none"
                    rows={3}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={reviewMutation.isPending}
                  className="text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200"
                  style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}
                >
                  {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
              </form>
            </div>
          )}

          {/* Individual Reviews */}
          <div className="space-y-6">
            {isLoadingReviews ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse border-b border-gray-200 pb-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-40"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : reviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 font-medium text-lg">No reviews yet. Be the first to review this app!</p>
              </div>
            ) : (
              reviews.map((review, index) => (
                <div key={review.id} className={`${index < reviews.length - 1 ? "border-b border-gray-200 pb-6" : ""}`}>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-black font-bold text-lg" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                      {review.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="font-bold text-black text-lg">{review.username}</span>
                        {renderStars(review.rating)}
                        <span className="text-sm font-medium text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 font-medium">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
