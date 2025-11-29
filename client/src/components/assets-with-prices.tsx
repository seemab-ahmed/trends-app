import { Asset } from "@shared/schema";
import AssetCard from "./asset-card";
import { useAssetsWithPrices } from "@/hooks/use-assets-with-prices";
import { Progress } from "@/components/ui/progress";

interface AssetsWithPricesProps {
  assets: Asset[];
}

export default function AssetsWithPrices({ assets }: AssetsWithPricesProps) {
  const { assetsWithPrices, isLoading, progress, checkedCount, totalCount } = useAssetsWithPrices(assets);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Loading assets with available prices...</span>
            <span>{checkedCount}/{totalCount} checked ({progress}%)</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
        
        {/* Show available assets progressively */}
        {assetsWithPrices.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Found {assetsWithPrices.length} assets with prices so far...
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assetsWithPrices.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        )}
        
        {/* Show skeleton for remaining slots */}
        {assetsWithPrices.length < 6 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(Math.max(0, 6 - assetsWithPrices.length))].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="h-32 w-full bg-muted animate-pulse rounded-lg" />
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (assetsWithPrices.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No assets with available prices found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {assetsWithPrices.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}
