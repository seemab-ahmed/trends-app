import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Edit, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/api-config";

interface ProfileEditFormProps {
  currentBio: string | null;
  username: string;
  onCancel: () => void;
}

export default function ProfileEditForm({
  currentBio,
  username,
  onCancel,
}: ProfileEditFormProps) {
  const [bio, setBio] = useState(currentBio || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { bio: string }) => {
      const response = await apiRequest(
        "PUT",
        API_ENDPOINTS.USER_PROFILE(),
        data
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      onCancel();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateProfileMutation.mutateAsync({
        bio: bio.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white border border-white text-black shadow-lg rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black">
          <Edit className="h-5 w-5 text-gray-500" />
          Edit Profile
        </CardTitle>
        <CardDescription className="text-gray-500">
          Update your profile information
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Bio Field */}
          <div>
            <Label
              htmlFor="bio"
              className="text-sm font-medium text-gray-300 mb-1 block"
            >
              Bio
            </Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full bg-white border border-[#2C2F36] text-black placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] rounded-lg resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {bio.length}/500 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded-md shadow-md transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 border border-[#2C2F36] bg-[#23272b] text-white hover:bg-[#2C2F36] font-medium rounded-md shadow-md transition-all duration-200"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
