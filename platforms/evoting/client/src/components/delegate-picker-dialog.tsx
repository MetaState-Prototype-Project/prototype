"use client";

import { useState, useEffect } from "react";
import { Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/apiClient";

interface GroupMember {
  id: string;
  ename: string;
  name?: string;
  avatarUrl?: string;
}

interface DelegatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  currentUserId: string;
  onSelect: (delegateId: string) => void;
}

export function DelegatePickerDialog({
  open,
  onOpenChange,
  groupId,
  currentUserId,
  onSelect,
}: DelegatePickerDialogProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (open && groupId) {
      fetchGroupMembers();
    }
  }, [open, groupId]);

  const fetchGroupMembers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/api/groups/${groupId}`);
      const group = response.data;
      
      const allMembers: GroupMember[] = [];
      const seenIds = new Set<string>();

      const addMembers = (memberList: GroupMember[] | undefined) => {
        if (!memberList) return;
        for (const member of memberList) {
          if (!seenIds.has(member.id) && member.id !== currentUserId) {
            seenIds.add(member.id);
            allMembers.push(member);
          }
        }
      };

      addMembers(group.members);
      addMembers(group.admins);
      addMembers(group.participants);

      setMembers(allMembers);
    } catch (error) {
      console.error("Failed to fetch group members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(query) ||
      member.ename?.toLowerCase().includes(query)
    );
  });

  const handleSelect = () => {
    if (selectedMemberId) {
      onSelect(selectedMemberId);
      setSelectedMemberId(null);
      setSearchQuery("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select a Delegate
          </DialogTitle>
          <DialogDescription>
            Choose a group member to vote on your behalf
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-2">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No members found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedMemberId === member.id
                        ? "bg-primary/10 border-2 border-primary"
                        : "hover:bg-gray-100 border-2 border-transparent"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatarUrl} />
                      <AvatarFallback>
                        {member.name?.[0] || member.ename?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.name || member.ename}
                      </p>
                      {member.name && (
                        <p className="text-sm text-gray-500 truncate">
                          {member.ename}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!selectedMemberId}>
              Delegate Vote
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
