import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";

const suggestAssetSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  symbol: z.string().min(1, "Symbol is required").max(20, "Symbol cannot exceed 20 characters"),
  type: z.enum(["stock", "crypto", "forex"], {
    required_error: "Please select an asset type",
  }),
  note: z.string().max(500).optional(),
});

type SuggestAssetData = z.infer<typeof suggestAssetSchema>;

export default function SuggestAssetForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Create form
  const form = useForm<SuggestAssetData>({
    resolver: zodResolver(suggestAssetSchema),
    defaultValues: {
      name: "",
      symbol: "",
      type: "stock",
      note: "",
    },
  });

  // Submit handler
  const mutation = useMutation({
    mutationFn: async (data: SuggestAssetData) => {
      const res = await apiRequest('POST', '/api/asset-suggestions', data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit suggestion');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Asset suggestion submitted!",
        description: "Thanks for your contribution. We'll review it soon.",
      });
      form.reset();
      setFormSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit suggestion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: SuggestAssetData) {
    mutation.mutate(data);
  }

  if (formSubmitted) {
    return (
      <div className="text-center p-4">
        <h3 className="text-lg font-medium mb-2">Thanks for your suggestion!</h3>
        <p className="text-muted-foreground mb-4">
          We'll review it and add it to our platform soon.
        </p>
        <Button
          onClick={() => setFormSubmitted(false)}
          variant="outline"
        >
          Suggest Another Asset
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Taiwan Semiconductor" {...field} />
              </FormControl>
              <FormDescription>
                The full name of the company or cryptocurrency
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="symbol"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ticker Symbol</FormLabel>
              <FormControl>
                <Input placeholder="e.g. TSM or BTC or EUR/USD" {...field} />
              </FormControl>
              <FormDescription>
                The ticker symbol used on exchanges
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset Type</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Cryptocurrency</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Select the asset class
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional details" {...field} />
              </FormControl>
              <FormDescription>
                Why should we add this asset?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suggest Asset
        </Button>
      </form>
    </Form>
  );
}