import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock } from "lucide-react";
import type { UserWithProfile } from "@shared/schema";

interface ProfileCompletionProps {
  userProfile?: UserWithProfile;
  isLoading: boolean;
}

export default function ProfileCompletion({ userProfile, isLoading }: ProfileCompletionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-8" />
          </div>
          <Skeleton className="h-2 w-full mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center">
                <Skeleton className="h-4 w-4 rounded-full mr-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full mt-4" />
        </CardContent>
      </Card>
    );
  }

  const completionPercentage = userProfile?.profile?.completionPercentage || 0;
  
  const checklistItems = [
    {
      label: "Basic Information",
      completed: !!(userProfile?.firstName && userProfile?.lastName && userProfile?.profile?.bio),
    },
    {
      label: "Skills & Hobbies",
      completed: !!(userProfile?.skills?.length || userProfile?.hobbies?.length),
    },
    {
      label: "Wishlist Items",
      completed: !!(userProfile?.wishlistItems?.length),
    },
    {
      label: "Habits & Preferences",
      completed: !!(userProfile?.habits?.length),
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Profile Completion</h2>
          <span className="text-primary font-medium">{completionPercentage}%</span>
        </div>
        
        <Progress value={completionPercentage} className="mb-4">
          <div className="progress-bar h-full rounded-full transition-all duration-300" 
               style={{ width: `${completionPercentage}%` }} />
        </Progress>
        
        <div className="space-y-3">
          {checklistItems.map((item, index) => (
            <div key={index} className="flex items-center text-sm">
              {item.completed ? (
                <CheckCircle className="h-4 w-4 text-accent mr-2" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400 mr-2" />
              )}
              <span className={item.completed ? "text-gray-700" : "text-gray-500"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        
        <Button 
          className="w-full mt-4 gradient-primary text-white hover:opacity-90 transition-opacity"
          onClick={() => window.location.href = "/profile"}
        >
          Complete Profile
        </Button>
      </CardContent>
    </Card>
  );
}
