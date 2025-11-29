import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, AlertCircle } from "lucide-react";

const emailChangeSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
});

type EmailChangeFormData = z.infer<typeof emailChangeSchema>;

export default function EmailChangeForm() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmailChangeFormData>({
    resolver: zodResolver(emailChangeSchema),
  });

  const emailChangeMutation = useMutation({
    mutationFn: async (data: EmailChangeFormData) => {
      const res = await apiRequest("POST", "/api/user/change-email", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to change email");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsSuccess(true);
      reset();
      toast({
        title: t("email_verification.change_email_success"),
        description: t("email_verification.email_changed"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("email_verification.change_email_error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmailChangeFormData) => {
    emailChangeMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <Card className="bg-[#1E1F25] border border-[#2C2F36] text-neutral-200 rounded-2xl shadow-md font-poppins">
        <CardHeader className="text-center border-b border-[#2C2F36] pb-3">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-[#2563EB]" />
            </div>
          </div>
          <CardTitle className="text-lg font-semibold text-white">
            {t("email_verification.change_email_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <Alert className="bg-[#16391c] border border-[#2d5232] text-green-400 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("email_verification.email_changed")}
            </AlertDescription>
          </Alert>

          <Button
            onClick={() => setIsSuccess(false)}
            variant="outline"
            className="w-full mt-5 border border-[#3A3C42] bg-transparent text-neutral-200 hover:bg-[#2C2F36] rounded-md shadow-sm"
          >
            Change Another Email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1E1F25] border border-[#2C2F36] text-neutral-200 rounded-2xl shadow-md font-poppins">
      <CardHeader className="text-center border-b border-[#2C2F36] pb-3">
        <div className="flex justify-center mb-2">
          <div className="h-12 w-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-[#2563EB]" />
          </div>
        </div>
        <CardTitle className="text-lg font-semibold text-white">
          {t("email_verification.change_email_title")}
        </CardTitle>
        <CardDescription className="text-gray-400 text-sm mt-1">
          Change your email address. You will need to verify the new email
          before making predictions.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* New Email */}
          <div>
            <Label htmlFor="newEmail" className="text-sm text-gray-300">
              {t("email_verification.new_email_label")}
            </Label>
            <Input
              id="newEmail"
              type="email"
              {...register("newEmail")}
              placeholder="Enter new email address"
              className={`mt-1 bg-[#2A2F36] border ${
                errors.newEmail ? "border-red-500" : "border-[#2C2F36]"
              } text-gray-100 focus-visible:ring-[#2563EB]`}
            />
            {errors.newEmail && (
              <p className="text-xs text-red-500 mt-1">
                {errors.newEmail.message}
              </p>
            )}
          </div>

          {/* Current Password */}
          <div>
            <Label htmlFor="currentPassword" className="text-sm text-gray-300">
              {t("email_verification.current_password_label")}
            </Label>
            <Input
              id="currentPassword"
              type="password"
              {...register("currentPassword")}
              placeholder="Enter your current password"
              className={`mt-1 bg-[#2A2F36] border ${
                errors.currentPassword ? "border-red-500" : "border-[#2C2F36]"
              } text-gray-100 focus-visible:ring-[#2563EB]`}
            />
            {errors.currentPassword && (
              <p className="text-xs text-red-500 mt-1">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={emailChangeMutation.isPending}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded-md shadow-sm mt-2"
          >
            {emailChangeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing Email...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t("email_verification.change_email_button")}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
