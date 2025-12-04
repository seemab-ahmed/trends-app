import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { TrendingUp, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../hooks/use-toast";
import { useLanguage } from "../hooks/use-language";
import { apiRequest } from "@/lib/queryClient";

const predictionSchema = z.object({
  assetSymbol: z.string().min(1, "Asset is required"),
  duration: z.string().min(1, "Duration is required"),
  direction: z.enum(["up", "down"], {
    required_error: "Direction is required",
  }),
});

type PredictionFormData = z.infer<typeof predictionSchema>;

interface EnhancedPredictionFormProps {
  assetSymbol?: string;
  onSuccess?: () => void;
}

export function EnhancedPredictionForm({
  assetSymbol,
  onSuccess,
}: EnhancedPredictionFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedDuration, setSelectedDuration] = useState<string>("short");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const form = useForm<PredictionFormData>({
    resolver: zodResolver(predictionSchema),
    defaultValues: {
      assetSymbol: assetSymbol || "",
      duration: "short",
      direction: "up",
    },
  });

  useEffect(() => {
    if (form.getValues("duration") !== selectedDuration) {
      form.setValue("duration", selectedDuration);
    }
  }, [selectedDuration, form]);

  const createPredictionMutation = useMutation({
    mutationFn: async (data: PredictionFormData) => {
      const priceResponse = await fetch(
        `/api/catalog/price/${encodeURIComponent(data.assetSymbol)}`
      );
      if (!priceResponse.ok) {
        const errorData = await priceResponse.json().catch(() => ({
          message: "Unknown error",
        }));
        throw new Error(
          errorData.message ||
            "Failed to fetch current price for prediction. The asset may be unavailable or delisted."
        );
      }

      const priceData = await priceResponse.json();
      if (!priceData.price || priceData.price <= 0) {
        throw new Error("Invalid price received. Cannot create prediction.");
      }

      const res = await apiRequest("POST", "/api/predictions", {
        ...data,
        amount: 1.0,
        slotNumber: 1,
        currentPrice: priceData.price,
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to create prediction" }));
        throw new Error(error.error || "Failed to create prediction");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your prediction has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      queryClient.invalidateQueries({ queryKey: ["slots", selectedDuration] });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit prediction",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PredictionFormData) => {
    createPredictionMutation.mutate({
      ...data,
      duration: selectedDuration,
    });
  };

  const handleDurationChange = (duration: string) => {
    setSelectedDuration(duration);
    form.setValue("duration", duration);
    form.trigger("duration");
    setDropdownOpen(false);
  };

  const getDurationOptions = () => [
    { value: "short", label: "Short Term (1 Week)" },
    { value: "medium", label: "Medium Term (1 Month)" },
    { value: "long", label: "Long Term (3 Months)" },
  ];

  return (
    <Card className=" border border-0 bg-white rounded-3xl  text-gray-200 font-poppins">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-black">
          Make Prediction
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Asset Display */}
          <div className="space-y-2">
            <div className="flex items-center bg-white border border-[#3A3D45] rounded-lg px-4 py-3">
              <Badge className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md">
                {assetSymbol?.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Duration Selection (Custom Dropdown) */}
          <div className="space-y-2 relative">
            <Label className="text-sm text-black">Duration</Label>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex justify-between items-center w-full bg-[#2A2D33] border border-[#3A3D45] text-gray-200 rounded-lg h-10 text-sm px-4 hover:bg-[#34373E] transition"
            >
              <span>
                {
                  getDurationOptions().find((d) => d.value === selectedDuration)
                    ?.label
                }
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute z-10 mt-2 w-full bg-[#1E1F25] border border-[#2C2F36] rounded-lg shadow-lg">
                {getDurationOptions().map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleDurationChange(option.value)}
                    className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                      selectedDuration === option.value
                        ? "bg-blue-600 text-white"
                        : "text-gray-200 hover:bg-[#2A2D33]"
                    }`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Direction Buttons */}
          <div className="space-y-2">
            <Label className="text-sm text-black">Direction</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.setValue("direction", "up")}
                className={`flex-1 py-3 text-white rounded-lg text-sm font-medium transition-colors ${
                  form.watch("direction") === "up"
                    ? "bg-green-700 hover:bg-green-700 border-green-600"
                    : "bg-green-600 hover:bg-green-700 border-green-700"
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Up
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => form.setValue("direction", "down")}
                className={`flex-1 py-3 text-white rounded-lg text-sm font-medium transition-colors ${
                  form.watch("direction") === "down"
                    ? "bg-red-700 hover:bg-red-700 border-red-600"
                    : "bg-red-600 hover:bg-red-700 border-red-700"
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-2 rotate-180" />
                Down
              </Button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-medium"
            disabled={createPredictionMutation.isPending}
          >
            {createPredictionMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting Prediction...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Submit Prediction
              </>
            )}
          </Button>

          {/* Submission Status */}
          {createPredictionMutation.isPending && (
            <div className="text-center text-sm text-gray-400">
              Please wait while we submit your prediction...
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
